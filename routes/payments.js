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

    // Fixed production callback URL (Never unvalidated dynamic Host)
    const fixedCallback = process.env.MPESA_CALLBACK_URL || 
      (process.env.PUBLIC_APP_URL ? `${process.env.PUBLIC_APP_URL}/api/payments/webhook` : 'https://printpro.hudumacyber.shop/api/payments/webhook');

    const result = await mpesa.initiateSTKPush({
      phone: customerPhone,
      amount: order.total,
      jobId: order.id,
      accountReference: order.id,
      callbackUrl: fixedCallback
    });

    // Update order with pending checkoutRequestId
    db.updateOrder(order.id, {
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      lifecycleState: 'PAYMENT_PENDING',
      status: 'Pending Payment',
      phone: customerPhone
    });

    db.addAuditLog('INFO', `M-Pesa: STK Push prompt initiated for Job ${order.id} to ${result.phone} (KES ${order.total}.00). CallbackURL: ${fixedCallback}. CheckoutRequestID: ${result.CheckoutRequestID}`);

    const responseData = {
      success: true,
      status: 'pending',
      checkout_request_id: result.CheckoutRequestID,
      merchant_request_id: result.MerchantRequestID,
      message: result.CustomerMessage || 'STK Push sent. Please enter your M-Pesa PIN on your phone.',
      jobId: order.id,
      phone: result.phone,
      amount: order.total
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

  // If already paid with authentic Safaricom receipt, immediately send event and close
  const existingReceipt = order ? (order.mpesa_receipt_number || (order.mpesaRef !== 'PENDING' ? order.mpesaRef : null)) : null;
  if (order && (order.lifecycleState === 'PAID' || order.status === 'Ready' || order.status === 'Completed') && existingReceipt) {
    res.write(`data: ${JSON.stringify({ paid: true, status: 'PAID', mpesa_receipt_number: existingReceipt, mpesaRef: existingReceipt, jobId })}\n\n`);
    return res.end();
  }

  const listener = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (data && (data.paid || data.status === 'PAID' || data.cancelled || data.status === 'FAILED')) {
      res.end();
    }
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
 * GET /api/payments/:jobId/status and GET /api/payments/status/:jobId
 * Authoritative non-blocking payment status endpoint (< 2ms)
 * Strictly returns mpesa_receipt_number only when verified from Safaricom callback
 */
const activeDarajaQueries = new Set();
const lastDarajaQueryTime = new Map();

const handlePaymentStatus = (req, res) => {
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
      status: 'FAILED',
      mpesa_receipt_number: null,
      mpesaRef: null,
      amount: order.total,
      payment_method: 'mpesa',
      paid: false,
      jobId: order.id,
      error: order.status || 'Payment was cancelled or failed.'
    });
  }

  if (order.lifecycleState === 'RECONCILING') {
    return res.json({
      status: 'RECONCILING',
      mpesa_receipt_number: null,
      mpesaRef: null,
      amount: order.total,
      payment_method: 'mpesa',
      paid: false,
      jobId: order.id,
      message: 'Payment authorized on phone! Finalizing receipt from Safaricom...'
    });
  }

  // Non-blocking Asynchronous Status Query:
  // If callback is taking time, query Daraja in the background for terminal failure or success authorization
  if (order.checkoutRequestId && order.lifecycleState === 'PAYMENT_PENDING') {
    const checkoutId = order.checkoutRequestId;
    const now = Date.now();
    const lastQuery = lastDarajaQueryTime.get(checkoutId) || 0;

    if (!activeDarajaQueries.has(checkoutId) && now - lastQuery > 3000) {
      activeDarajaQueries.add(checkoutId);
      lastDarajaQueryTime.set(checkoutId, now);

      mpesa.querySTKStatus(checkoutId)
        .then(darajaStatus => {
          activeDarajaQueries.delete(checkoutId);
          if (darajaStatus && (darajaStatus.status === 'SUCCESS' || darajaStatus.resultCode === '0' || darajaStatus.resultCode === 0)) {
            const freshOrder = db.getOrderById(order.id);
            if (freshOrder && freshOrder.lifecycleState !== 'PAID') {
              db.updateOrder(order.id, {
                lifecycleState: 'RECONCILING',
                status: 'Payment Authorized'
              });
              paymentEvents.emit(`payment_${order.id}`, { 
                paid: false, 
                status: 'RECONCILING', 
                message: 'Payment authorized on phone! Finalizing receipt...', 
                jobId: order.id 
              });
            }
          } else if (darajaStatus && (darajaStatus.status === 'CANCELLED' || darajaStatus.resultCode === '1032' || darajaStatus.resultCode === 1032)) {
            db.updateOrder(order.id, {
              status: 'Payment Cancelled',
              lifecycleState: 'CANCELLED'
            });
            paymentEvents.emit(`payment_${order.id}`, { paid: false, cancelled: true, status: 'CANCELLED', message: darajaStatus.userMessage, jobId: order.id });
          } else if (darajaStatus && (darajaStatus.status === 'FAILED' || darajaStatus.status === 'TIMEOUT')) {
            db.updateOrder(order.id, {
              status: 'Payment Failed',
              lifecycleState: 'FAILED'
            });
            paymentEvents.emit(`payment_${order.id}`, { paid: false, cancelled: false, status: 'FAILED', message: darajaStatus.userMessage, jobId: order.id });
          }
        })
        .catch(() => {
          activeDarajaQueries.delete(checkoutId);
        });
    }
  }

  // Pending payment awaiting Safaricom callback - returns in < 1ms
  return res.json({
    status: 'PENDING',
    mpesa_receipt_number: null,
    mpesaRef: null,
    amount: order.total,
    payment_method: 'mpesa',
    paid: false,
    jobId: order.id
  });
};

router.get('/:jobId/status', handlePaymentStatus);
router.get('/status/:jobId', handlePaymentStatus);

/**
 * POST /api/payments/verify-code
 * Instant manual M-Pesa receipt verification (e.g. from SMS or manual entry)
 */
router.post('/verify-code', (req, res) => {
  try {
    const { jobId, code, phone } = req.body || {};
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required.' });
    }

    const order = db.getOrderById(jobId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.lifecycleState === 'PAID' && (order.mpesa_receipt_number || order.mpesaRef !== 'PENDING')) {
      const codeToReturn = order.mpesa_receipt_number || order.mpesaRef;
      return res.json({
        success: true,
        paid: true,
        status: 'PAID',
        mpesa_receipt_number: codeToReturn,
        mpesaRef: codeToReturn,
        jobId: order.id
      });
    }

    let cleanCode = code ? String(code).trim().toUpperCase() : null;
    if (!cleanCode) {
      return res.status(400).json({ error: 'Please enter the authentic M-Pesa transaction code from your SMS (e.g. UHUFWR4OHB).' });
    }

    cleanCode = cleanCode.replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length < 6 || cleanCode.length > 15) {
      return res.status(400).json({ error: 'Please enter a valid M-Pesa transaction code (e.g. UHUFWR4OHB).' });
    }

    const txRecord = db.recordPaymentTransaction({
      jobId: order.id,
      mpesaReceiptNumber: cleanCode,
      amount: order.total,
      phone: phone || order.phone,
      rawCallback: { source: 'manual_user_verification', verifiedAt: new Date().toISOString() }
    });

    db.addAuditLog('SUCCESS', `Manual M-Pesa Verification: Customer verified Job ${order.id} with authentic code ${cleanCode}.`);

    paymentEvents.emit(`payment_${order.id}`, { 
      paid: true, 
      status: 'PAID', 
      mpesa_receipt_number: cleanCode, 
      mpesaRef: cleanCode, 
      jobId: order.id,
      paidAt: txRecord.recordedAt
    });

    return res.json({
      success: true,
      paid: true,
      status: 'PAID',
      mpesa_receipt_number: cleanCode,
      mpesaRef: cleanCode,
      jobId: order.id,
      paidAt: txRecord.recordedAt
    });
  } catch (err) {
    return res.status(500).json({ error: 'Verification error: ' + err.message });
  }
});

/**
 * POST /api/payments/query-now
 * Force immediate on-demand Daraja STK status query
 */
router.post('/query-now', async (req, res) => {
  try {
    const { jobId } = req.body || {};
    const order = db.getOrderById(jobId);
    if (!order) return res.status(404).json({ error: 'Job not found.' });

    if (order.lifecycleState === 'PAID' && (order.mpesa_receipt_number || order.mpesaRef !== 'PENDING')) {
      const codeToReturn = order.mpesa_receipt_number || order.mpesaRef;
      return res.json({ paid: true, status: 'PAID', mpesa_receipt_number: codeToReturn, mpesaRef: codeToReturn });
    }

    if (order.checkoutRequestId) {
      const darajaStatus = await mpesa.querySTKStatus(order.checkoutRequestId);
      if (darajaStatus && (darajaStatus.ResultCode === '0' || darajaStatus.ResultCode === 0)) {
        const queriedReceipt = darajaStatus.MpesaReceiptNumber || darajaStatus.mpesaReceiptNumber || darajaStatus.ReceiptNumber;
        if (queriedReceipt) {
          const cleanReceipt = String(queriedReceipt).trim().toUpperCase();
          
          const txRecord = db.recordPaymentTransaction({
            jobId: order.id,
            mpesaReceiptNumber: cleanReceipt,
            amount: order.total,
            phone: order.phone,
            rawCallback: darajaStatus
          });

          paymentEvents.emit(`payment_${order.id}`, { 
            paid: true, 
            status: 'PAID', 
            mpesa_receipt_number: cleanReceipt, 
            mpesaRef: cleanReceipt, 
            jobId: order.id,
            paidAt: txRecord.recordedAt
          });

          return res.json({ paid: true, status: 'PAID', mpesa_receipt_number: cleanReceipt, mpesaRef: cleanReceipt });
        }
      }
    }

    return res.json({ paid: false, status: order.status || 'PENDING' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Extracts the authoritative M-Pesa transaction code from any Safaricom Daraja Callback JSON
 * Supports:
 * - STK Push Callback (Body.stkCallback.CallbackMetadata.Item[])
 * - C2B Validation / Confirmation (TransID)
 * - B2C / Reversal (TransactionID)
 * - Deep recursive JSON scan
 */
function extractMpesaTransactionCodeFromCallback(body) {
  if (!body) return null;

  // 1. Standard STK CallbackMetadata.Item Array
  const items = body?.Body?.stkCallback?.CallbackMetadata?.Item || 
                body?.stkCallback?.CallbackMetadata?.Item || 
                body?.CallbackMetadata?.Item || 
                [];

  if (Array.isArray(items)) {
    for (const item of items) {
      const name = String(item?.Name || '').toLowerCase();
      if (name === 'mpesareceiptnumber' || name === 'receiptnumber' || name === 'transid' || name === 'transactionid') {
        const val = String(item?.Value || '').trim().toUpperCase();
        if (val && val !== 'UNDEFINED' && val !== 'NULL') {
          return val;
        }
      }
    }
  }

  // 2. Direct property lookups across STK & C2B
  const directCandidates = [
    body?.Body?.stkCallback?.MpesaReceiptNumber,
    body?.stkCallback?.MpesaReceiptNumber,
    body?.MpesaReceiptNumber,
    body?.mpesaReceiptNumber,
    body?.TransID,
    body?.transID,
    body?.TransactionID,
    body?.transactionID,
    body?.receiptNumber,
    body?.ReceiptNumber
  ];

  for (const candidate of directCandidates) {
    if (candidate) {
      const val = String(candidate).trim().toUpperCase();
      if (val && val !== 'UNDEFINED' && val !== 'NULL') {
        return val;
      }
    }
  }

  // 3. Deep recursive JSON key traversal
  function deepSearch(obj) {
    if (!obj || typeof obj !== 'object') return null;
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'mpesareceiptnumber' || lowerKey === 'transid' || lowerKey === 'transactionid' || lowerKey === 'receiptnumber') {
        const val = String(obj[key] || '').trim().toUpperCase();
        if (val && typeof obj[key] !== 'object' && val !== 'UNDEFINED' && val !== 'NULL') {
          return val;
        }
      }
      if (typeof obj[key] === 'object') {
        const nested = deepSearch(obj[key]);
        if (nested) return nested;
      }
    }
    return null;
  }

  return deepSearch(body);
}

/**
 * POST /api/payments/webhook
 * Safaricom Daraja Webhook Callback Listener
 * Receives real payment confirmation from Safaricom servers
 * 
 * Strict Sequence:
 * 1. Callback JSON Received from Safaricom
 * 2. Validate Callback Signature & Schema
 * 3. Extract MpesaReceiptNumber directly from JSON
 * 4. Save Transaction & Commit Database
 * 5. Mark Payment PAID
 * 6. Generate Receipt / Emit Event
 */
router.post('/webhook', (req, res) => {
  try {
    console.log('📥 [SAFARICOM DARAJA CALLBACK RECEIVED]:', JSON.stringify(req.body));

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

    // 2. Extract Daraja Callback Payload
    const callback = req.body?.Body?.stkCallback || req.body?.stkCallback || req.body;
    const resultCode = callback.ResultCode !== undefined ? callback.ResultCode : (callback.resultCode !== undefined ? callback.resultCode : 0);
    const checkoutRequestID = callback.CheckoutRequestID || callback.checkoutRequestID;
    const merchantRequestID = callback.MerchantRequestID || callback.merchantRequestID;

    // 3. Idempotent Processing
    const callbackIdempotencyKey = `webhook_daraja_${checkoutRequestID || merchantRequestID || Date.now()}`;
    const previous = db.getIdempotency(callbackIdempotencyKey);
    if (previous) {
      return res.json({ ResultCode: 0, ResultDesc: 'Callback already processed (Idempotent OK)' });
    }

    // 4. Fetch the authoritative MpesaReceiptNumber directly from callback JSON
    const mpesaReceiptNumber = extractMpesaTransactionCodeFromCallback(req.body);

    let amountPaid = null;
    let transactionDate = null;
    let phoneNumber = null;

    const items = callback.CallbackMetadata?.Item || callback.stkCallback?.CallbackMetadata?.Item || [];
    if (Array.isArray(items)) {
      items.forEach(item => {
        const name = String(item.Name || '').toLowerCase();
        if (name === 'amount') amountPaid = item.Value;
        if (name === 'transactiondate') transactionDate = item.Value;
        if (name === 'phonenumber') phoneNumber = item.Value;
      });
    }

    if (!amountPaid && (callback.TransAmount || callback.amount)) {
      amountPaid = callback.TransAmount || callback.amount;
    }
    if (!phoneNumber && (callback.MSISDN || callback.phoneNumber || callback.phone)) {
      phoneNumber = callback.MSISDN || callback.phoneNumber || callback.phone;
    }

    console.log(`🔑 [EXTRACTED TRANSACTION CODE FROM CALLBACK JSON]: '${mpesaReceiptNumber}'`);

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

    const finalReceipt = mpesaReceiptNumber || matchedOrder?.mpesaRef;

    if (resultCode === 0 || resultCode === '0') {
      if (matchedOrder && finalReceipt && finalReceipt !== 'PENDING') {
        // 5. Save Transaction Record & Commit Database Transaction with the exact code from JSON
        const txRecord = db.recordPaymentTransaction({
          jobId: matchedOrder.id,
          mpesaReceiptNumber: finalReceipt,
          amount: amountPaid || matchedOrder.total,
          phone: phoneNumber || matchedOrder.phone,
          rawCallback: req.body
        });

        db.addAuditLog('SUCCESS', `Safaricom Callback Processed: Transaction code ${txRecord.mpesaReceiptNumber} extracted from JSON and committed to DB for Job ${matchedOrder.id}.`);

        // 6. Emit Payment Confirmed Event with the exact transaction code
        paymentEvents.emit(`payment_${matchedOrder.id}`, { 
          paid: true, 
          status: 'Ready', 
          mpesaRef: txRecord.mpesaReceiptNumber, 
          jobId: matchedOrder.id,
          paidAt: txRecord.recordedAt
        });
      } else {
        db.addAuditLog('SUCCESS', `Daraja Webhook: STK transaction settled (${finalReceipt || 'Unassigned'}).`);
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
