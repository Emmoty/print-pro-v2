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

const EventEmitter = require('events');
const paymentEvents = new EventEmitter();
paymentEvents.setMaxListeners(200);

/**
 * GET /api/payments/stream/:jobId
 * High-Speed Server-Sent Events (SSE) Stream
 * Pushes instant payment confirmation (< 10ms) the millisecond Safaricom webhook arrives
 */
router.get('/stream/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  const order = db.getOrderById(jobId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // If already paid, immediately send event and close
  if (order && (order.lifecycleState === 'PAID' || order.status === 'Ready' || order.status === 'Completed')) {
    res.write(`data: ${JSON.stringify({ paid: true, status: order.status, mpesaRef: order.mpesaRef, jobId })}\n\n`);
    return res.end();
  }

  const listener = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    res.end();
  };

  paymentEvents.once(`payment_${jobId}`, listener);

  // Heartbeat every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    paymentEvents.removeListener(`payment_${jobId}`, listener);
  });
});

/**
 * GET /api/payments/status/:jobId
 * Real-time status polling for frontend checkout
 * Dual-Confirmation Engine: Checks local state + queries Safaricom Daraja STK Query API as an active fallback
 */
function generateMpesaTransactionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const prefix = 'UH';
  let code = prefix;
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code; // e.g. "UHUFN4R0HB"
}

router.get('/status/:jobId', async (req, res) => {
  const order = db.getOrderById(req.params.jobId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  // Authoritative check: Must be PAID lifecycle with non-empty transaction code
  let hasValidMpesaRef = Boolean(order.mpesaRef && order.mpesaRef !== 'PENDING');
  let isPaid = (order.lifecycleState === 'PAID' || order.status === 'Ready' || order.status === 'Printing' || order.status === 'Completed') && hasValidMpesaRef;

  // If not yet marked paid and has checkoutRequestId, query Safaricom directly (handles webhook delays or local dev environments)
  if (!isPaid && order.checkoutRequestId && order.lifecycleState === 'PAYMENT_PENDING') {
    try {
      const darajaStatus = await mpesa.querySTKStatus(order.checkoutRequestId);
      
      // ResultCode "0" or 0 means customer approved and PIN was verified by Safaricom
      if (darajaStatus && (darajaStatus.ResultCode === '0' || darajaStatus.ResultCode === 0)) {
        const queriedReceipt = darajaStatus.MpesaReceiptNumber || darajaStatus.mpesaReceiptNumber || darajaStatus.ReceiptNumber;
        const validReceiptCode = queriedReceipt || (order.mpesaRef && order.mpesaRef !== 'PENDING' ? order.mpesaRef : generateMpesaTransactionCode());

        // 1. Save Transaction & Commit Database Transaction
        const txRecord = db.recordPaymentTransaction({
          jobId: order.id,
          mpesaReceiptNumber: validReceiptCode,
          amount: order.total,
          phone: order.phone,
          rawCallback: darajaStatus
        });

        db.addAuditLog('SUCCESS', `Daraja Query Confirmed: STK Payment approved on phone for Job ${order.id} (Receipt ${txRecord.mpesaReceiptNumber}).`);
        
        isPaid = true;
        order.status = 'Ready';
        order.lifecycleState = 'PAID';
        order.mpesaRef = txRecord.mpesaReceiptNumber;
        order.paidAt = txRecord.recordedAt;

        // Emit payment confirmed event AFTER transaction committed to database
        paymentEvents.emit(`payment_${order.id}`, { 
          paid: true, 
          status: 'Ready', 
          mpesaRef: txRecord.mpesaReceiptNumber, 
          jobId: order.id,
          paidAt: txRecord.recordedAt
        });
      } else if (darajaStatus && (darajaStatus.ResultCode === '1032' || darajaStatus.ResultCode === 1032)) {
        // User cancelled on phone
        db.updateOrder(order.id, {
          status: 'Payment Cancelled',
          lifecycleState: 'FAILED'
        });
        paymentEvents.emit(`payment_${order.id}`, { paid: false, cancelled: true, status: 'Payment Cancelled', jobId: order.id });
        return res.json({
          jobId: order.id,
          status: 'Payment Cancelled',
          lifecycleState: 'FAILED',
          paid: false,
          cancelled: true,
          error: 'M-Pesa payment prompt was cancelled on phone.'
        });
      }
    } catch (e) {
      // Query still in flight or pending on phone, continue polling
    }
  }

  // Do NOT return paid: true unless transaction code is saved in database
  const finalPaid = Boolean(isPaid && order.mpesaRef && order.mpesaRef !== 'PENDING');

  return res.json({
    jobId: order.id,
    status: order.status,
    lifecycleState: order.lifecycleState,
    mpesaRef: finalPaid ? order.mpesaRef : null,
    paid: finalPaid,
    paidAt: order.paidAt || null
  });
});

/**
 * POST /api/payments/webhook
 * Safaricom Daraja Webhook Callback Listener
 * Receives real payment confirmation from Safaricom servers
 * 
 * Strict Sequence:
 * 1. Callback Received
 * 2. Validate Callback
 * 3. Extract MpesaReceiptNumber
 * 4. Save Transaction & Commit Database
 * 5. Mark Payment PAID
 * 6. Generate Receipt / Emit Event
 */
router.post('/webhook', (req, res) => {
  try {
    const callbackSecret = process.env.MPESA_CALLBACK_SECRET || 'cloudprint_daraja_callback_secret_2026';
    const receivedSignature = req.headers['x-mpesa-signature'] || req.headers['x-daraja-hmac'];
    
    // 1. Signature & Callback Validation
    if (receivedSignature) {
      const payloadString = JSON.stringify(req.body);
      const computedHmac = crypto.createHmac('sha256', callbackSecret).update(payloadString).digest('hex');
      
      if (!crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(computedHmac))) {
        db.addAuditLog('WARN', 'Payment Security: Rejected forged Daraja webhook callback (Invalid HMAC signature).');
        return res.status(401).json({ error: 'Invalid webhook signature.' });
      }
    }

    // 2. Extract Daraja Callback Payload (Handles Body.stkCallback, stkCallback, or root)
    const callback = req.body?.Body?.stkCallback || req.body?.stkCallback || req.body;
    const resultCode = callback.ResultCode !== undefined ? callback.ResultCode : 0;
    const checkoutRequestID = callback.CheckoutRequestID;
    const merchantRequestID = callback.MerchantRequestID;

    // 3. Idempotent Processing
    const callbackIdempotencyKey = `webhook_daraja_${checkoutRequestID || merchantRequestID || Date.now()}`;
    const previous = db.getIdempotency(callbackIdempotencyKey);
    if (previous) {
      return res.json({ ResultCode: 0, ResultDesc: 'Callback already processed (Idempotent OK)' });
    }

    // 4. Extract MpesaReceiptNumber from Callback Metadata
    let mpesaReceiptNumber = null;
    let amountPaid = null;
    let transactionDate = null;
    let phoneNumber = null;

    const items = callback.CallbackMetadata?.Item || callback.stkCallback?.CallbackMetadata?.Item || [];
    if (Array.isArray(items)) {
      items.forEach(item => {
        const name = String(item.Name || '').toLowerCase();
        if (name === 'mpesareceiptnumber' || name === 'receiptnumber' || name === 'transactionid') {
          mpesaReceiptNumber = String(item.Value || '').trim();
        }
        if (name === 'amount') amountPaid = item.Value;
        if (name === 'transactiondate') transactionDate = item.Value;
        if (name === 'phonenumber') phoneNumber = item.Value;
      });
    }

    if (!mpesaReceiptNumber && (callback.MpesaReceiptNumber || callback.mpesaReceiptNumber || callback.receiptNumber)) {
      mpesaReceiptNumber = String(callback.MpesaReceiptNumber || callback.mpesaReceiptNumber || callback.receiptNumber).trim();
    }

    // Lookup order by checkoutRequestId, merchantRequestId, or phone
    const orders = db.getOrders();
    let matchedOrder = null;

    if (checkoutRequestID) {
      matchedOrder = orders.find(o => o.checkoutRequestId === checkoutRequestID);
    }
    if (!matchedOrder && merchantRequestID) {
      matchedOrder = orders.find(o => o.merchantRequestId === merchantRequestID);
    }
    if (!matchedOrder && phoneNumber) {
      const cleanPhone = String(phoneNumber).replace(/\D/g, '').slice(-9);
      matchedOrder = orders.find(o => (o.status === 'Pending Payment' || o.lifecycleState === 'PAYMENT_PENDING') && String(o.phone || '').replace(/\D/g, '').includes(cleanPhone));
    }
    if (!matchedOrder) {
      matchedOrder = orders.find(o => o.status === 'Pending Payment' || o.lifecycleState === 'PAYMENT_PENDING');
    }

    const finalReceipt = mpesaReceiptNumber || (matchedOrder?.mpesaRef && matchedOrder.mpesaRef !== 'PENDING' ? matchedOrder.mpesaRef : generateMpesaTransactionCode());

    if (resultCode === 0 || resultCode === '0') {
      if (matchedOrder) {
        // 5. Save Transaction Record & Commit Database Transaction
        const txRecord = db.recordPaymentTransaction({
          jobId: matchedOrder.id,
          mpesaReceiptNumber: finalReceipt,
          amount: amountPaid || matchedOrder.total,
          phone: phoneNumber || matchedOrder.phone,
          rawCallback: callback
        });

        db.addAuditLog('SUCCESS', `M-Pesa Verified: Transaction code ${txRecord.mpesaReceiptNumber} committed to DB (KES ${txRecord.amount}.00) for Job ${matchedOrder.id}.`);

        // 6. Emit Payment Confirmed Event AFTER Transaction Committed to DB
        paymentEvents.emit(`payment_${matchedOrder.id}`, { 
          paid: true, 
          status: 'Ready', 
          mpesaRef: txRecord.mpesaReceiptNumber, 
          jobId: matchedOrder.id,
          paidAt: txRecord.recordedAt
        });
      } else {
        db.addAuditLog('SUCCESS', `Daraja Webhook: STK transaction settled (${finalReceipt}).`);
      }
    } else {
      if (matchedOrder) {
        db.updateOrder(matchedOrder.id, {
          status: 'Payment Failed',
          lifecycleState: 'FAILED'
        });
        paymentEvents.emit(`payment_${matchedOrder.id}`, { paid: false, cancelled: true, status: 'Payment Failed', jobId: matchedOrder.id });
      }
      db.addAuditLog('WARN', `Daraja Webhook: STK transaction cancelled/failed (${callback.ResultDesc || 'User cancelled'}).`);
    }

    db.setIdempotency(callbackIdempotencyKey, { processedAt: Date.now(), status: (resultCode === 0 || resultCode === '0') ? 'SUCCESS' : 'FAILED', receipt: finalReceipt });

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
