/**
 * ==============================================================================
 * CloudPrint Pro - Modular Safaricom Daraja M-Pesa Payment Routes
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const auth = require('../lib/auth');
const paymentEngine = require('../lib/mpesa/paymentEngine');
const sseManager = require('../lib/mpesa/sseManager');

/**
 * POST /api/payments/stk-push
 * Dispatches a real Lipa Na M-Pesa Online STK Push prompt to customer's phone
 */
router.post('/stk-push', async (req, res) => {
  try {
    const { jobId, phone, amount, idempotencyKey } = req.body || {};
    const result = await paymentEngine.initiateSTKPush({ jobId, phone, amount, idempotencyKey });
    return res.json(result);
  } catch (err) {
    db.addAuditLog('ERROR', `M-Pesa STK Push error: ${err.message}`);
    return res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  }
});

/**
 * GET /api/payments/stream/:jobId
 * Real-time Server-Sent Events (SSE) Stream (< 10ms webhook push)
 */
router.get('/stream/:jobId', (req, res) => {
  sseManager.handleStream(req, res, db);
});

/**
 * GET /api/payments/:jobId/status and GET /api/payments/status/:jobId
 * Authoritative non-blocking payment status endpoint (< 1ms response)
 */
const lastQueryTimes = new Map();

const handlePaymentStatus = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const order = db.getOrderById(jobId);
    if (!order) {
      return res.status(404).json({ error: 'Associated print job not found.' });
    }

    const authenticReceipt = order.mpesa_receipt_number || (order.mpesaRef && order.mpesaRef !== 'PENDING' ? order.mpesaRef : null);
    const isPaid = (order.lifecycleState === 'PAID' || order.status === 'Ready' || order.status === 'Completed') && Boolean(authenticReceipt);

    if (isPaid) {
      return res.json({
        status: 'PAID',
        mpesa_receipt_number: authenticReceipt,
        mpesaRef: authenticReceipt,
        amount: order.total,
        payment_method: 'mpesa',
        paid: true,
        jobId: order.id,
        paidAt: order.paidAt || order.timestamp
      });
    }

    if (order.lifecycleState === 'FAILED' || order.lifecycleState === 'CANCELLED' || order.status === 'Payment Cancelled' || order.status === 'Payment Failed') {
      return res.json({
        status: order.lifecycleState || 'FAILED',
        mpesa_receipt_number: null,
        mpesaRef: null,
        amount: order.total,
        payment_method: 'mpesa',
        paid: false,
        jobId: order.id,
        error: order.status || 'Payment was cancelled or rejected on phone.'
      });
    }

    // Background Non-blocking Query if pending (throttled every 3s)
    if (order.checkoutRequestId && (order.lifecycleState === 'PAYMENT_PENDING' || order.lifecycleState === 'RECONCILING')) {
      const now = Date.now();
      const lastQuery = lastQueryTimes.get(order.checkoutRequestId) || 0;
      if (now - lastQuery > 3000) {
        lastQueryTimes.set(order.checkoutRequestId, now);
        paymentEngine.queryAndSettleTransaction(order.id).catch(() => {});
      }
    }

    return res.json({
      status: order.lifecycleState || 'PENDING',
      mpesa_receipt_number: null,
      mpesaRef: null,
      amount: order.total,
      payment_method: 'mpesa',
      paid: false,
      jobId: order.id
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

router.get('/:jobId/status', handlePaymentStatus);
router.get('/status/:jobId', handlePaymentStatus);

/**
 * POST /api/payments/query-now
 * Instant On-Demand PIN verification & unblocking settlement
 */
router.post('/query-now', async (req, res) => {
  try {
    const { jobId } = req.body || {};
    if (!jobId) return res.status(400).json({ error: 'Job ID is required.' });
    const result = await paymentEngine.queryAndSettleTransaction(jobId);
    return res.json(result);
  } catch (err) {
    return res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

/**
 * POST /api/payments/verify-code
 * Instant manual M-Pesa receipt verification from SMS
 */
router.post('/verify-code', (req, res) => {
  try {
    const { jobId, code, phone } = req.body || {};
    const result = paymentEngine.verifyManualCode({ jobId, code, phone });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  }
});

/**
 * POST /api/payments/webhook
 * Safaricom Daraja Webhook Callback Listener
 */
router.post('/webhook', (req, res) => {
  try {
    const result = paymentEngine.processWebhookCallback(req.body, req.headers);
    return res.json(result);
  } catch (err) {
    return res.status(err.message.includes('signature') ? 401 : 500).json({ error: err.message });
  }
});

/**
 * POST /api/payments/reversal
 * Issues an M-Pesa B2C reversal refund for a failed/cancelled job
 */
router.post('/reversal', auth.requireAuth, auth.requirePermission('orders'), (req, res) => {
  try {
    const { jobId, reason, amount } = req.body || {};
    const result = paymentEngine.processReversal({
      jobId,
      reason,
      amount,
      userMeta: { userId: req.user.userId, ip: req.user.ip }
    });
    return res.json(result);
  } catch (err) {
    return res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  }
});

module.exports = router;
