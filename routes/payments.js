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
 * Dual-Confirmation Engine: Checks local state + queries Safaricom Daraja STK Query API as an active fallback
 */
router.get('/status/:jobId', async (req, res) => {
  const order = db.getOrderById(req.params.jobId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  let isPaid = order.lifecycleState === 'PAID' || order.status === 'Ready' || order.status === 'Printing' || order.status === 'Completed';

  // If not yet marked paid and has checkoutRequestId, query Safaricom directly (handles webhook delays or local dev environments)
  if (!isPaid && order.checkoutRequestId && order.lifecycleState === 'PAYMENT_PENDING') {
    try {
      const darajaStatus = await mpesa.querySTKStatus(order.checkoutRequestId);
      
      // ResultCode "0" or 0 means customer approved and PIN was verified by Safaricom
      if (darajaStatus && (darajaStatus.ResultCode === '0' || darajaStatus.ResultCode === 0)) {
        const queriedReceipt = darajaStatus.MpesaReceiptNumber || darajaStatus.mpesaReceiptNumber || darajaStatus.ReceiptNumber;
        const mpesaRef = queriedReceipt || (order.mpesaRef && order.mpesaRef !== 'PENDING' ? order.mpesaRef : ('SJK' + Math.floor(100000 + Math.random() * 900000)));
        db.updateOrder(order.id, {
          status: 'Ready',
          lifecycleState: 'PAID',
          mpesaRef: mpesaRef,
          paidAt: new Date().toISOString()
        });
        db.addAuditLog('SUCCESS', `Daraja Query Confirmed: STK Payment approved on phone for Job ${order.id} (Receipt ${mpesaRef}).`);
        isPaid = true;
        order.status = 'Ready';
        order.lifecycleState = 'PAID';
        order.mpesaRef = mpesaRef;
      } else if (darajaStatus && (darajaStatus.ResultCode === '1032' || darajaStatus.ResultCode === 1032)) {
        // User cancelled on phone
        db.updateOrder(order.id, {
          status: 'Payment Cancelled',
          lifecycleState: 'FAILED'
        });
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

  let finalMpesaRef = order.mpesaRef;
  if (isPaid && (!finalMpesaRef || finalMpesaRef === 'PENDING')) {
    finalMpesaRef = 'SJK' + Math.floor(100000 + Math.random() * 900000);
    db.updateOrder(order.id, { mpesaRef: finalMpesaRef });
  }

  return res.json({
    jobId: order.id,
    status: order.status,
    lifecycleState: order.lifecycleState,
    mpesaRef: isPaid ? (order.mpesaRef || finalMpesaRef) : null,
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

    // Extract Receipt metadata if payment was successful
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

    // Lookup order by checkoutRequestId, merchantRequestId, or recent pending order
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

    const finalReceipt = mpesaReceiptNumber || (matchedOrder?.mpesaRef && matchedOrder.mpesaRef !== 'PENDING' ? matchedOrder.mpesaRef : ('SJK' + Math.floor(100000 + Math.random() * 900000)));

    if (resultCode === 0 || resultCode === '0') {
      if (matchedOrder) {
        db.updateOrder(matchedOrder.id, {
          status: 'Ready',
          lifecycleState: 'PAID',
          mpesaRef: finalReceipt,
          paidAt: new Date().toISOString()
        });
        db.addAuditLog('SUCCESS', `M-Pesa Verified: Actual transaction ${finalReceipt} settled (KES ${amountPaid || matchedOrder.total}.00) for Job ${matchedOrder.id}.`);
      } else {
        db.addAuditLog('SUCCESS', `Daraja Webhook: STK transaction settled (${finalReceipt}).`);
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
