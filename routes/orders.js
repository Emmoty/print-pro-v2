/**
 * CloudPrint Pro - Customer Orders & Document Upload API
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../lib/db');
const storage = require('../lib/storage');
const stateMachine = require('../lib/stateMachine');

// Memory storage for inspection before vault persistence
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 10
  }
});

/**
 * POST /api/orders/upload
 * Validates document magic bytes and stages into vault
 */
router.post('/upload', upload.array('documents', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No documents provided for upload.' });
    }

    const settings = db.getSettings();
    const maxMb = settings.maxFileSize || 50;
    const maxBytes = maxMb * 1024 * 1024;

    const stagedFiles = [];
    for (const file of req.files) {
      if (file.size > maxBytes) {
        return res.status(400).json({ error: `File "${file.originalname}" exceeds the configured limit of ${maxMb}MB.` });
      }

      const validation = storage.validateFileBuffer(file.buffer, file.originalname);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Save to private vault
      const vaultRecord = storage.saveToVault(file.buffer, file.originalname);
      stagedFiles.push({
        fileId: vaultRecord.fileId,
        name: vaultRecord.originalName,
        size: (vaultRecord.sizeBytes / (1024 * 1024)).toFixed(1) + ' MB',
        sizeBytes: vaultRecord.sizeBytes,
        ext: vaultRecord.ext,
        pages: 1 // Default initial estimate
      });
    }

    return res.json({
      message: 'Documents validated and staged securely in private vault.',
      files: stagedFiles
    });
  } catch (err) {
    return res.status(500).json({ error: 'File processing error: ' + err.message });
  }
});

/**
 * POST /api/orders/create
 * Creates a formal print job order with authoritative price calculation
 */
router.post('/create', (req, res) => {
  try {
    const {
      files,
      paperSize,
      colorMode,
      copies,
      phone,
      idempotencyKey
    } = req.body || {};

    // 1. Idempotency Check (Prevent duplicate jobs on network retry)
    if (idempotencyKey) {
      const existing = db.getIdempotency(idempotencyKey);
      if (existing) {
        return res.json(existing.data);
      }
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Please include at least one document.' });
    }

    // 2. Authoritative Server-Side Calculation
    const pricing = db.getPricing();
    const settings = db.getSettings();

    const totalPages = files.reduce((sum, f) => sum + (parseInt(f.pages, 10) || 1), 0);
    const maxPages = settings.maxPages || 300;

    if (totalPages > maxPages) {
      return res.status(400).json({ error: `Total pages (${totalPages}) exceed the configured limit of ${maxPages} pages per job.` });
    }

    const calculated = stateMachine.calculateAuthoritativePrice(pricing, paperSize, colorMode, totalPages, copies);

    // 3. Create Order Record
    const jobId = '#CP' + Math.floor(100000 + Math.random() * 900000);
    const order = {
      id: jobId,
      customer: 'Customer ' + (phone ? phone.slice(-4) : 'User'),
      phone: phone || '0712345678',
      fileName: files[0] ? files[0].name : 'Document.pdf',
      files: files,
      serviceName: calculated.colorMode === 'colour' ? (calculated.paperSize === 'a3' ? 'A3 Full Colour' : 'A4 Full Colour') : (calculated.paperSize === 'a3' ? 'A3 Monochrome' : 'A4 Black & White'),
      paperSize: calculated.paperSize,
      colorMode: calculated.colorMode,
      ratePerPage: calculated.ratePerPage,
      pages: totalPages,
      copies: calculated.copies,
      total: calculated.totalAmount,
      status: 'Ready',
      lifecycleState: 'PAYMENT_PENDING',
      mpesaRef: 'PENDING',
      timestamp: new Date().toISOString(),
      filePurged: false
    };

    db.addOrder(order);
    db.addAuditLog('INFO', `Order Created: Job ${jobId} registered for ${phone} (KES ${calculated.totalAmount}.00).`);

    const responsePayload = {
      message: 'Print job registered successfully.',
      order
    };

    if (idempotencyKey) {
      db.setIdempotency(idempotencyKey, responsePayload);
    }

    return res.json(responsePayload);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create print order: ' + err.message });
  }
});

/**
 * GET /api/orders/:id
 * Customer / Operator lifecycle query
 */
router.get('/:id', (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Print job not found.' });
  }
  return res.json({ order });
});

module.exports = router;
