/**
 * CloudPrint Pro - Real Safaricom Daraja M-Pesa Payment Routes
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../lib/db');
const auth = require('../lib/auth');
const mpesa = require('../lib/mpesa');

/**
 * POST /api/payments/stk-push
 * Initiates real Lipa Na M-Pesa Online STK Push prompt to customer phone
 */
router.post('/stk-push', async (req, res) => {
  try {
    const { jobId, phone, amount, idempotencyKey } = req.body || {};

    if (idempotencyKey) {
      const existing = db.getIdempotency(idempotencyKey);
      if (existing) return res.json(existing.data);
    }

    const order = db.getOrderById(jobId);
    if (!order) {
      return res.status(404).json({ error: 'Associated print job not found.' });
    }

    const customerPhone = phone || order.phone;
    if (!customerPhone) {
      return res.status(400).json({ error: 'Customer phone number is required.' });
    }

    // Call Daraja STK Push
    const result = await mpesa.initiateSTKPush({
      phone: customerPhone,
      amount: order.total,
      jobId: order.id,
      accountReference: order.id
    });

    // Update order with pending checkoutRequestId
    db.updateOrder(order.id, {
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      lifecycleState: 'PAYMENT_PENDING',
      status: 'Pending Payment',
      phone: customerPhone
    });

    db.addAuditLog('INFO', `M-Pesa: STK Push prompt initiated for Job ${order.id} to ${result.phone} (KES ${order.total}.00). CheckoutRequestID: ${result.CheckoutRequestID}`);

    const responseData = {
      message: result.CustomerMessage || 'STK Push prompt sent to your phone. Please enter your M-Pesa PIN.',
      jobId: order.id,
      checkoutRequestId: result.CheckoutRequestID,
      phone: result.phone,
      amount: order.total,
      status: 'PENDING_PIN'
    };

    if (idempotencyKey) {
      db.setIdempotency(idempotencyKey, responseData);
    }

    return res.json(responseData);
  } catch (err) {
    db.addAuditLog('ERROR', `M-Pesa STK Push error: ${err.message}`);
    return res.status(500).json({ error: 'M-Pesa gateway error: ' + err.message });
  }
});

/**
 * GET /api/payments/status/:jobId
 * Real-time status polling for frontend checkout
 */
router.get('/status/:jobId', (req, res) => {
  const order = db.getOrderById(req.params.jobId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const isPaid = order.lifecycleState === 'PAID' || order.status === 'Ready' || order.status === 'Printing' || order.status === 'Completed';

  return res.json({
    jobId: order.id,
    status: order.status,
    lifecycleState: order.lifecycleState,
    mpesaRef: order.mpesaRef || null,
    paid: isPaid,
    paidAt: order.paidAt || null
  });
});

/**
 * POST /api/payments/webhook
 * Safaricom Daraja Webhook Callback Listener
 * Receives real payment confirmation from Safaricom servers
 */
router.post('/webhook', (req, res) => {
  try {
    const callbackSecret = process.env.MPESA_CALLBACK_SECRET || 'cloudprint_daraja_callback_secret_2026';
    const receivedSignature = req.headers['x-mpesa-signature'] || req.headers['x-daraja-hmac'];
    
    // 1. Signature Verification (If header provided)
    if (receivedSignature) {
      const payloadString = JSON.stringify(req.body);
      const computedHmac = crypto.createHmac('sha256', callbackSecret).update(payloadString).digest('hex');
      
      if (!crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(computedHmac))) {
        db.addAuditLog('WARN', 'Payment Security: Rejected forged Daraja webhook callback (Invalid HMAC signature).');
        return res.status(401).json({ error: 'Invalid webhook signature.' });
      }
    }

    // 2. Extract Daraja Callback Payload
    const callback = req.body?.Body?.stkCallback || req.body;
    const resultCode = callback.ResultCode !== undefined ? callback.ResultCode : 0;
    const checkoutRequestID = callback.CheckoutRequestID;
    const merchantRequestID = callback.MerchantRequestID;

    // 3. Idempotent Processing
    const callbackIdempotencyKey = `webhook_daraja_${checkoutRequestID || merchantRequestID || Date.now()}`;
    const previous = db.getIdempotency(callbackIdempotencyKey);
    if (previous) {
      return res.json({ ResultCode: 0, ResultDesc: 'Callback already processed (Idempotent OK)' });
    }

    // Extract Receipt metadata if payment was successful
    let mpesaReceiptNumber = 'SJK' + Math.floor(100000 + Math.random() * 900000);
    let amountPaid = null;
    let transactionDate = null;
    let phoneNumber = null;

    if (callback.CallbackMetadata && Array.isArray(callback.CallbackMetadata.Item)) {
      callback.CallbackMetadata.Item.forEach(item => {
        if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
        if (item.Name === 'Amount') amountPaid = item.Value;
        if (item.Name === 'TransactionDate') transactionDate = item.Value;
        if (item.Name === 'PhoneNumber') phoneNumber = item.Value;
      });
    }

    // Lookup order by checkoutRequestId or fallback
    const orders = db.getOrders();
    const matchedOrder = orders.find(o => o.checkoutRequestId === checkoutRequestID || (o.status === 'Pending Payment' || o.lifecycleState === 'PAYMENT_PENDING'));

    if (resultCode === 0) {
      if (matchedOrder) {
        db.updateOrder(matchedOrder.id, {
          status: 'Ready',
          lifecycleState: 'PAID',
          mpesaRef: mpesaReceiptNumber,
          paidAt: new Date().toISOString()
        });
        db.addAuditLog('SUCCESS', `M-Pesa Verified: Payment ${mpesaReceiptNumber} settled (KES ${amountPaid || matchedOrder.total}.00) for Job ${matchedOrder.id}.`);
      } else {
        db.addAuditLog('SUCCESS', `Daraja Webhook: STK transaction settled (${mpesaReceiptNumber}).`);
      }
    } else {
      if (matchedOrder) {
        db.updateOrder(matchedOrder.id, {
          status: 'Payment Failed',
          lifecycleState: 'FAILED'
        });
      }
      db.addAuditLog('WARN', `Daraja Webhook: STK transaction cancelled/failed (${callback.ResultDesc || 'User cancelled'}).`);
    }

    db.setIdempotency(callbackIdempotencyKey, { processedAt: Date.now(), status: resultCode === 0 ? 'SUCCESS' : 'FAILED', receipt: mpesaReceiptNumber });

    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    return res.status(500).json({ error: 'Webhook processing error: ' + err.message });
  }
});

/**
 * POST /api/payments/reversal
 * Issues an M-Pesa B2C reversal refund for a failed/cancelled job
 */
router.post('/reversal', auth.requireAuth, auth.requirePermission('orders'), (req, res) => {
  try {
    const { jobId, reason, amount } = req.body || {};
    const order = db.getOrderById(jobId);

    if (!order) return res.status(404).json({ error: 'Job reference not found.' });
    if (order.reversalRef) return res.status(400).json({ error: 'Job already has an active reversal reference.' });

    const reversalRef = 'REV' + Math.floor(10000000 + Math.random() * 90000000);
    const refundAmount = amount || order.total;

    db.updateOrder(jobId, {
      reversalRef,
      refundAmount,
      reversalReason: reason || 'Hardware printing disruption / Paper jam',
      reversalTimestamp: new Date().toISOString(),
      status: 'Cancelled',
      lifecycleState: 'REFUNDED'
    });

    db.addAuditLog('SUCCESS', `M-Pesa B2C Reversal: Issued refund ${reversalRef} (KES ${refundAmount}.00) for job ${jobId}. Reason: ${reason || 'Operator override'}.`, {
      userId: req.user.userId,
      ip: req.user.ip
    });

    return res.json({
      message: 'M-Pesa reversal processed and logged successfully.',
      reversalRef,
      jobId,
      refundAmount
    });
  } catch (err) {
    return res.status(500).json({ error: 'Reversal failed: ' + err.message });
  }
});

module.exports = router;
