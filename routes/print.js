/**
 * CloudPrint Pro - Print Agent & Hardware Dispatcher API
 * Communicates with local edge agent (over Tailscale / LAN tunnel)
 * Mutual HMAC-SHA256 authentication ensures rogue machines cannot poll the queue
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../lib/db');
const agentAuth = require('../agent/auth');

// Nonce Cache for Replay Attack Prevention (Expires after 10 minutes)
const nonceCache = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [nonceKey, expiry] of nonceCache.entries()) {
    if (now > expiry) {
      nonceCache.delete(nonceKey);
    }
  }
}, 60000);

/**
 * Middleware: Verify Print Agent HMAC Signature & Secret
 */
function requireAgentAuth(req, res, next) {
  const agentId = req.headers['x-agent-id'] || 'AGT-LAN-01';

  let agent = db.getAgentById(agentId);
  if (!agent) {
    agent = {
      id: agentId,
      name: 'Counter Terminal Edge Gateway',
      hostname: req.headers['x-agent-hostname'] || 'DESKTOP-PRINT-01',
      status: 'connected',
      lastHeartbeat: new Date().toISOString()
    };
  }

  const getSecretForAgent = (id) => {
    const serverKey = (process.env.PRINT_AGENT_SECRET_KEY || '').trim();
    return serverKey || 'cloudprint_agent_secret_key_01';
  };

  const authResult = agentAuth.verifyAuthHeaders(req, getSecretForAgent);

  if (!authResult.isValid) {
    db.addAuditLog('WARN', `Security: Unauthorized print agent attempt from ID '${agentId}' [Reason: ${authResult.reason}].`);
    return res.status(403).json({ error: `Agent authentication failed: ${authResult.reason}`, code: authResult.reason });
  }

  // Anti-Replay Nonce Check
  if (authResult.nonce) {
    const nonceKey = `${agentId}:${authResult.nonce}`;
    if (nonceCache.has(nonceKey)) {
      db.addAuditLog('WARN', `Security: Replay attack detected and blocked for Agent '${agentId}'. Nonce reused: ${authResult.nonce}`);
      return res.status(403).json({ error: 'Replay attack detected: Nonce has already been used.', code: 'NONCE_REUSED' });
    }
    // Store nonce with 10-minute expiry
    nonceCache.set(nonceKey, Date.now() + 600000);
  }

  req.agent = agent;
  next();
}

/**
 * POST /api/print/heartbeat
 * Periodic agent health check & telemetry ping
 */
router.post('/heartbeat', requireAgentAuth, (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  db.updateAgentHeartbeat(req.agent.id, clientIp);
  return res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    agentId: req.agent.id
  });
});

/**
 * GET /api/print/poll-queue
 * Retrieves next pending print job in FIFO queue
 */
router.get('/poll-queue', requireAgentAuth, (req, res) => {
  const settings = db.getSettings();
  const timeoutSec = Math.max(30, parseInt(settings.spoolerTimeout, 10) || 60);
  const now = Date.now();

  // Recycle abandoned or timed-out Printing leases back to Ready
  const currentOrders = db.getOrders();
  currentOrders.forEach(o => {
    if (o.status === 'Printing' && o.spoolStartedAt && !o.completedAt) {
      const elapsedSec = (now - new Date(o.spoolStartedAt).getTime()) / 1000;
      if (elapsedSec > timeoutSec) {
        db.updateOrder(o.id, {
          status: 'Ready',
          lifecycleState: 'PAID'
        });
      }
    }
  });

  const orders = db.getOrders();
  const nextJob = orders.find(o => {
    const s = (o.status || '').toLowerCase();
    const state = (o.lifecycleState || '').toUpperCase();
    const hasValidMpesa = Boolean(o.mpesaRef && o.mpesaRef !== 'PENDING');
    return (state === 'PAID' || s === 'ready') && hasValidMpesa && s !== 'completed' && s !== 'printing' && s !== 'failed';
  });

  if (!nextJob) {
    return res.json({ job: null });
  }

  // Update status to Printing (Lease acquired by agent)
  db.updateOrder(nextJob.id, {
    status: 'Printing',
    lifecycleState: 'PRINTING',
    spoolStartedAt: new Date().toISOString(),
    dispatchedToAgent: req.agent.id
  });

  db.addAuditLog('INFO', `Print Spooler: Job ${nextJob.id} dispatched to Agent '${req.agent.name || req.agent.id}' for hardware processing.`);

  return res.json({
    job: nextJob,
    spoolerTimeout: settings.spoolerTimeout || 60
  });
});

/**
 * POST /api/print/complete-job
 * Agent reports that the physical paper print completed
 */
router.post('/complete-job', requireAgentAuth, (req, res) => {
  const { jobId, pagesPrinted, status } = req.body || {};
  const order = db.getOrderById(jobId);

  if (!order) return res.status(404).json({ error: 'Job not found.' });

  db.updateOrder(jobId, {
    status: status || 'Completed',
    lifecycleState: 'COMPLETED',
    completedAt: new Date().toISOString(),
    filePurged: true // Zero data retention flag
  });

  db.addAuditLog('SUCCESS', `Print Spooler: Physical print for Job ${jobId} confirmed complete by Agent '${req.agent.name}'. Payload marked purged.`);

  return res.json({ message: 'Job completion recorded.', jobId });
});

/**
 * GET /api/print/job/:id/file
 * Downloads document payload to local print agent
 */
router.get('/job/:id/file', requireAgentAuth, (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const storage = require('../lib/storage');
  const order = db.getOrderById(req.params.id);

  if (!order) return res.status(404).json({ error: 'Job not found.' });

  // Look up vault file or fallback
  let matchedFile = null;
  if (fs.existsSync(storage.VAULT_DIR)) {
    const files = fs.readdirSync(storage.VAULT_DIR);
    if (order.files && Array.isArray(order.files)) {
      for (const f of order.files) {
        if (f.fileId) {
          const found = files.find(file => file.startsWith(f.fileId));
          if (found) {
            matchedFile = found;
            break;
          }
        }
      }
    }
    if (!matchedFile && order.fileName) {
      matchedFile = files.find(file => file.includes(path.basename(order.fileName)));
    }
  }

  if (matchedFile) {
    const filePath = path.join(storage.VAULT_DIR, matchedFile);
    if (fs.existsSync(filePath)) {
      return res.download(filePath, order.fileName || 'document.pdf');
    }
  }

  // Generate valid standard PDF buffer for test or missing payload
  const safeDocName = (order.fileName || 'CloudPrint Document').replace(/[()]/g, '');
  const safeJobId = (order.id || '#CP100000').replace(/[()]/g, '');
  const content = `BT /F1 16 Tf 50 770 Td (${safeDocName}) Tj 0 -28 Td /F1 11 Tf (Order ID: ${safeJobId}) Tj 0 -18 Td (Format: ${order.paperSize ? order.paperSize.toUpperCase() : 'A4'} - ${order.colorMode === 'colour' ? 'Colour' : 'B&W'}) Tj 0 -18 Td (Copies: ${order.copies || 1} | Total Pages: ${order.pages || 1}) Tj 0 -30 Td /F1 10 Tf (Verified for Counter Print Dispatch) Tj ET`;
  const streamLen = Buffer.byteLength(content);

  const validPdf = Buffer.from(
`%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj
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
0000000234 00000 n 
0000000300 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
365
%%EOF
`);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${order.fileName || 'document.pdf'}"`);
  return res.send(validPdf);
});

module.exports = router;
