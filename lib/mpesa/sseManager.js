/**
 * ==============================================================================
 * CloudPrint Pro - Real-time Server-Sent Events (SSE) Stream Manager
 * ==============================================================================
 * Provides ultra-low-latency (< 10ms) push notifications from webhook callbacks
 * directly to connected customer kiosks and browser clients.
 */

const EventEmitter = require('events');

class PaymentSSEManager {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(500);
  }

  /**
   * Broadcasts a payment event for a specific print job
   */
  emitPaymentEvent(jobId, data) {
    if (!jobId) return;
    const cleanId = String(jobId).trim().replace(/^#/, '');
    
    // Emit for both '#CP123456' and 'CP123456' representations
    this.emitter.emit(`payment_${cleanId}`, data);
    this.emitter.emit(`payment_#${cleanId}`, data);
  }

  /**
   * Attaches an SSE stream response to listen for job payment events
   */
  handleStream(req, res, db) {
    const jobId = req.params.jobId;
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required.' });
    }

    const cleanId = String(jobId).trim().replace(/^#/, '');
    const order = db.getOrderById(jobId);

    // Standard SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // If order is already settled, send event immediately and end
    const existingReceipt = order ? (order.mpesa_receipt_number || (order.mpesaRef !== 'PENDING' ? order.mpesaRef : null)) : null;
    if (order && (order.lifecycleState === 'PAID' || order.status === 'Ready' || order.status === 'Completed') && existingReceipt) {
      res.write(`data: ${JSON.stringify({ 
        paid: true, 
        status: 'PAID', 
        mpesa_receipt_number: existingReceipt, 
        mpesaRef: existingReceipt, 
        jobId: order.id,
        paidAt: order.paidAt || order.timestamp
      })}\n\n`);
      return res.end();
    }

    const listener = (data) => {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        if (data && (data.paid || data.status === 'PAID' || data.cancelled || data.status === 'FAILED')) {
          res.end();
        }
      } catch (e) {}
    };

    this.emitter.once(`payment_${cleanId}`, listener);

    // 15-second heartbeat ping to prevent reverse proxy timeouts (Nginx / Cloudflare)
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (e) {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      this.emitter.removeListener(`payment_${cleanId}`, listener);
    });
  }
}

module.exports = new PaymentSSEManager();
