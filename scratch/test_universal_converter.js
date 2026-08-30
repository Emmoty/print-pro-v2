/**
 * Universal Document Converter & Normalizer Verification Suite
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const converter = require('../agent/converter');

console.log('🔄 STARTING UNIVERSAL CONVERTER TEST SUITE...\n');

const testDir = path.join(__dirname, 'test_converter_output');
fs.mkdirSync(testDir, { recursive: true });

// 1. Test Magic Byte Identification
console.log('🧪 Test 1: Magic Byte Identification');
const pdfBytes = Buffer.from('%PDF-1.4 header');
const pngBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
const jpgBytes = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
const webpBytes = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
const zipBytes = Buffer.from([0x50, 0x4B, 0x03, 0x04]);

assert.strictEqual(converter.inspectMagicBytes(pdfBytes), 'pdf');
assert.strictEqual(converter.inspectMagicBytes(pngBytes), 'png');
assert.strictEqual(converter.inspectMagicBytes(jpgBytes), 'jpg');
assert.strictEqual(converter.inspectMagicBytes(webpBytes), 'webp');
assert.strictEqual(converter.inspectMagicBytes(zipBytes), 'zip_office');
console.log('  ✔ Magic bytes correctly identified for PDF, PNG, JPG, WEBP, and ZIP Office.');

// 2. Test PNG to Normalized A4 PDF
console.log('\n🧪 Test 2: PNG to Normalized A4 PDF Conversion');
const samplePngPath = path.join(testDir, 'test.png');
const samplePngPdf = path.join(testDir, 'test_png_out.pdf');
const sample1x1Png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync(samplePngPath, sample1x1Png);

const pngResult = converter.convertImageToPdf(samplePngPath, samplePngPdf, 'a4', 'portrait');
assert.ok(fs.existsSync(samplePngPdf), 'Converted PDF must exist on disk');
assert.strictEqual(pngResult.pages, 1, 'Image conversion produces 1 page');
assert.strictEqual(pngResult.paperSize, 'A4');
console.log('  ✔ PNG successfully converted to standard A4 PDF.');

// 3. Test WEBP / JPG to Normalized Landscape A3 PDF
console.log('\n🧪 Test 3: Image to Landscape A3 PDF Conversion');
const sampleJpgPdf = path.join(testDir, 'test_jpg_out.pdf');
const jpgResult = converter.convertImageToPdf(samplePngPath, sampleJpgPdf, 'a3', 'landscape');
assert.ok(fs.existsSync(sampleJpgPdf), 'Landscape A3 PDF must exist');
assert.strictEqual(jpgResult.paperSize, 'A3');
assert.strictEqual(jpgResult.dimensions.width, converter.PAPER_DIMENSIONS.a3.height);
console.log('  ✔ Image successfully converted to Landscape A3 PDF.');

// 4. Test Universal Pipeline Router
console.log('\n🧪 Test 4: Universal Pipeline Router (processDocumentToPrintablePdf)');
async function testRouter() {
  const normResult = await converter.processDocumentToPrintablePdf(samplePngPath, { paperSize: 'a4', orientation: 'portrait' }, testDir);
  assert.ok(fs.existsSync(normResult.pdfPath), 'Printable PDF must be created');
  assert.strictEqual(normResult.format, 'png');
  assert.strictEqual(normResult.converted, true);
  console.log('  ✔ Pipeline router correctly processed image to printable PDF.');

  // Cleanup test artifacts
  try { fs.rmSync(testDir, { recursive: true, force: true }); } catch (e) {}

  console.log('\n================================================================');
  console.log('🎉 ALL UNIVERSAL CONVERTER TESTS PASSED (100%)!');
  console.log('================================================================\n');
}

testRouter();
