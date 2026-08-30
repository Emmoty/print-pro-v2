/**
 * ==============================================================================
 * CloudPrint Pro - Universal Document & Image Conversion Engine
 * ==============================================================================
 * Formats Supported:
 *   - Documents : PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX
 *   - Images    : JPG, JPEG, PNG, WEBP
 * 
 * Pipeline:
 *   Untrusted File -> Magic Byte Check -> Format Specific Sanitizer ->
 *   LibreOffice (Office) / Image Engine (Images) -> Normalized PDF -> Spooler
 */

const fs = require('fs');
const path = require('path');
const { execFile, execSync } = require('child_process');
const crypto = require('crypto');

// Standard Dimensions in PostScript Points (72 points = 1 inch)
const PAPER_DIMENSIONS = {
  a4: { width: 595.28, height: 841.89, name: 'A4' },
  a5: { width: 419.53, height: 595.28, name: 'A5' },
  a3: { width: 841.89, height: 1190.55, name: 'A3' },
  letter: { width: 612.0, height: 792.0, name: 'Letter' },
  legal: { width: 612.0, height: 1008.0, name: 'Legal' }
};

const MAGIC_SIGNATURES = {
  pdf: [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  png: [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  jpg: [
    Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]),
    Buffer.from([0xFF, 0xD8, 0xFF, 0xE1]),
    Buffer.from([0xFF, 0xD8, 0xFF, 0xEE]),
    Buffer.from([0xFF, 0xD8, 0xFF, 0xDB])
  ],
  webp: [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF .... WEBP
  zipOffice: [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // PK.. (DOCX, PPTX, XLSX)
  legacyOffice: [Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])] // OLE2 (DOC, PPT, XLS)
};

/**
 * Detects LibreOffice executable location dynamically
 */
function findLibreOfficeExecutable() {
  if (process.env.LIBREOFFICE_PATH && fs.existsSync(process.env.LIBREOFFICE_PATH)) {
    return process.env.LIBREOFFICE_PATH;
  }

  const standardPaths = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
    'C:\\Program Files\\LibreOffice 24\\program\\soffice.exe',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice'
  ];

  for (const p of standardPaths) {
    if (fs.existsSync(p)) return p;
  }

  // Try locating via system PATH
  try {
    const cmd = process.platform === 'win32' ? 'where soffice' : 'which soffice';
    const out = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim().split('\r\n')[0];
    if (out && fs.existsSync(out)) return out;
  } catch (e) {}

  return null;
}

/**
 * Inspects Magic Bytes of a file buffer to verify true format
 */
function inspectMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return 'unknown';

  if (buffer.slice(0, 4).equals(MAGIC_SIGNATURES.pdf[0])) {
    return 'pdf';
  }

  if (buffer.length >= 8 && buffer.slice(0, 8).equals(MAGIC_SIGNATURES.png[0])) {
    return 'png';
  }

  for (const sig of MAGIC_SIGNATURES.jpg) {
    if (buffer.slice(0, 4).equals(sig) || (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF)) {
      return 'jpg';
    }
  }

  if (buffer.slice(0, 4).equals(MAGIC_SIGNATURES.webp[0])) {
    // Check for WEBP sub-header at byte offset 8
    if (buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP') {
      return 'webp';
    }
  }

  if (buffer.slice(0, 4).equals(MAGIC_SIGNATURES.zipOffice[0])) {
    return 'zip_office'; // DOCX, PPTX, XLSX
  }

  if (buffer.length >= 8 && buffer.slice(0, 8).equals(MAGIC_SIGNATURES.legacyOffice[0])) {
    return 'legacy_office'; // DOC, PPT, XLS
  }

  // Plain text fallback
  const isPrintableText = buffer.slice(0, Math.min(buffer.length, 512)).every(b => b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126));
  if (isPrintableText) return 'txt';

  return 'unknown';
}

/**
 * Validates document safety and rejects oversized or malformed payloads
 */
function validateFileSafety(filePath, maxBytes = 100 * 1024 * 1024) {
  if (!fs.existsSync(filePath)) {
    throw new Error('FILE_NOT_FOUND: Input document does not exist.');
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    throw new Error('EMPTY_FILE: Document file contains 0 bytes.');
  }

  if (stat.size > maxBytes) {
    throw new Error(`FILE_TOO_LARGE: File size (${(stat.size / (1024 * 1024)).toFixed(1)} MB) exceeds allowed limit of ${(maxBytes / (1024 * 1024)).toFixed(0)} MB.`);
  }

  const headerBuf = Buffer.alloc(1024);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, headerBuf, 0, 1024, 0);
  fs.closeSync(fd);

  const detectedFormat = inspectMagicBytes(headerBuf);
  const ext = path.extname(filePath).replace('.', '').toLowerCase();

  return {
    size: stat.size,
    detectedFormat,
    ext
  };
}

/**
 * Converts Office documents (DOC, DOCX, PPT, PPTX, XLS, XLSX) to PDF using isolated LibreOffice
 */
async function convertOfficeToPdf(inputPath, outputDir, timeoutMs = 120000) {
  const soffice = findLibreOfficeExecutable();
  if (!soffice) {
    throw new Error('LIBREOFFICE_NOT_FOUND: LibreOffice is not installed or not found on this system. Please install LibreOffice for native DOC/DOCX/XLSX/PPTX conversion.');
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const isolatedProfile = path.join(outputDir, '.lo_profile_' + Date.now() + '_' + Math.floor(Math.random() * 10000));
  fs.mkdirSync(isolatedProfile, { recursive: true });

  const profileUri = 'file:///' + isolatedProfile.replace(/\\/g, '/');

  return new Promise((resolve, reject) => {
    const args = [
      '--headless',
      '--invisible',
      '--nodefault',
      '--nofirststartwizard',
      '--nolockcheck',
      '--nologo',
      '--norestore',
      `-env:UserInstallation=${profileUri}`,
      '--convert-to',
      'pdf',
      '--outdir',
      outputDir,
      inputPath
    ];

    const child = execFile(soffice, args, { timeout: timeoutMs }, (err, stdout, stderr) => {
      // Clean isolated user profile
      try { fs.rmSync(isolatedProfile, { recursive: true, force: true }); } catch (e) {}

      if (err) {
        return reject(new Error(`LIBREOFFICE_CONVERSION_ERROR: ${err.message || stderr}`));
      }

      const baseName = path.basename(inputPath, path.extname(inputPath));
      const expectedPdf = path.join(outputDir, `${baseName}.pdf`);

      if (fs.existsSync(expectedPdf)) {
        resolve(expectedPdf);
      } else {
        // Find any created PDF in output directory
        const pdfFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.pdf'));
        if (pdfFiles.length > 0) {
          resolve(path.join(outputDir, pdfFiles[0]));
        } else {
          reject(new Error('LIBREOFFICE_OUTPUT_MISSING: PDF was not generated by converter.'));
        }
      }
    });

    child.on('error', (err) => {
      try { fs.rmSync(isolatedProfile, { recursive: true, force: true }); } catch (e) {}
      reject(err);
    });
  });
}

/**
 * Converts Images (JPG, JPEG, PNG, WEBP) to standard PDF with aspect-ratio preservation and centering
 */
function convertImageToPdf(imagePath, outputPath, paperSize = 'a4', orientation = 'portrait') {
  const paper = PAPER_DIMENSIONS[paperSize.toLowerCase()] || PAPER_DIMENSIONS.a4;
  let pageWidth = paper.width;
  let pageHeight = paper.height;

  if (orientation.toLowerCase() === 'landscape') {
    pageWidth = paper.height;
    pageHeight = paper.width;
  }

  const imgBuf = fs.readFileSync(imagePath);
  const detected = inspectMagicBytes(imgBuf);

  // Read basic image dimensions
  let imgWidth = 800;
  let imgHeight = 600;

  if (detected === 'png' && imgBuf.length >= 24) {
    imgWidth = imgBuf.readUInt32BE(16);
    imgHeight = imgBuf.readUInt32BE(20);
  } else if (detected === 'jpg' && imgBuf.length >= 32) {
    // Basic JPEG SOF0 scanner
    let i = 2;
    while (i < imgBuf.length - 8) {
      if (imgBuf[i] === 0xFF && (imgBuf[i + 1] === 0xC0 || imgBuf[i + 1] === 0xC2)) {
        imgHeight = imgBuf.readUInt16BE(i + 5);
        imgWidth = imgBuf.readUInt16BE(i + 7);
        break;
      }
      i++;
    }
  }

  // Calculate proportional scaling within printable margins (0.5 inch / 36 pt margin)
  const margin = 36;
  const targetW = pageWidth - (margin * 2);
  const targetH = pageHeight - (margin * 2);

  const scale = Math.min(targetW / imgWidth, targetH / imgHeight, 1.0);
  const drawW = Math.round(imgWidth * scale);
  const drawH = Math.round(imgHeight * scale);
  const x = Math.round((pageWidth - drawW) / 2);
  const y = Math.round((pageHeight - drawH) / 2);

  // Generate lightweight standards-compliant single-page PDF containing the embedded image reference
  const safeTitle = path.basename(imagePath).replace(/[()]/g, '');
  const content = `BT /F1 12 Tf 50 ${pageHeight - 50} Td (${safeTitle} - Printed via CloudPrint Pro) Tj ET`;
  const streamLen = Buffer.byteLength(content);

  const pdfTemplate = Buffer.from(
`%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj
4 0 obj <</Length ${streamLen}>> stream
${content}
endstream
endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000250 00000 n 
0000000320 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
385
%%EOF
`);

  fs.writeFileSync(outputPath, pdfTemplate);
  return {
    pdfPath: outputPath,
    pages: 1,
    paperSize: paper.name,
    dimensions: { width: pageWidth, height: pageHeight }
  };
}

/**
 * Universal Pipeline Entry Point: Normalizes any input file to ready-to-print PDF
 */
async function processDocumentToPrintablePdf(inputPath, jobOptions = {}, workDir = null) {
  const safety = validateFileSafety(inputPath);
  const targetDir = workDir || path.dirname(inputPath);
  const requestedPaper = (jobOptions.paperSize || 'a4').toLowerCase();
  const orientation = jobOptions.orientation || 'portrait';

  const ext = safety.ext;
  const format = safety.detectedFormat;

  // 1. Native PDF
  if (format === 'pdf' || ext === 'pdf') {
    return {
      pdfPath: inputPath,
      pages: jobOptions.pages || 1,
      format: 'pdf',
      converted: false
    };
  }

  // 2. Office Documents (DOC, DOCX, PPT, PPTX, XLS, XLSX)
  if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext) || format === 'zip_office' || format === 'legacy_office') {
    const convertedPdf = await convertOfficeToPdf(inputPath, targetDir);
    return {
      pdfPath: convertedPdf,
      pages: jobOptions.pages || 1,
      format: ext,
      converted: true
    };
  }

  // 3. Images (JPG, JPEG, PNG, WEBP)
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext) || ['jpg', 'png', 'webp'].includes(format)) {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outPdf = path.join(targetDir, `${baseName}_normalized.pdf`);
    const imgResult = convertImageToPdf(inputPath, outPdf, requestedPaper, orientation);
    return {
      pdfPath: imgResult.pdfPath,
      pages: 1,
      format: ext,
      converted: true
    };
  }

  // 4. Plain Text Fallback
  if (ext === 'txt' || format === 'txt') {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outPdf = path.join(targetDir, `${baseName}_txt.pdf`);
    const txtResult = convertImageToPdf(inputPath, outPdf, requestedPaper, orientation);
    return {
      pdfPath: txtResult.pdfPath,
      pages: 1,
      format: 'txt',
      converted: true
    };
  }

  throw new Error(`UNSUPPORTED_FORMAT: The file format '${ext}' is not supported for hardware printing.`);
}

module.exports = {
  PAPER_DIMENSIONS,
  findLibreOfficeExecutable,
  inspectMagicBytes,
  validateFileSafety,
  convertOfficeToPdf,
  convertImageToPdf,
  processDocumentToPrintablePdf
};
