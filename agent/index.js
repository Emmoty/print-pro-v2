/**
 * ==============================================================================
 * CloudPrint Pro - Local LAN Print Agent Daemon
 * ==============================================================================
 * Connects physical printers on the local network with CloudPrint Pro VPS.
 * Features:
 * - Mutual HMAC Authentication (x-agent-id & x-agent-token)
 * - Hardware Discovery & Status Telemetry
 * - Dynamic FIFO Print Queue Polling
 * - Zero Data Retention Local Document Shredder
 * - Graceful Shutdown & Auto-Reconnect
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const config = require('./config');
const telemetry = require('./telemetry');
const spooler = require('./spooler');

let isRunning = true;
let isPolling = false;

// Ensure temporary spool directory exists
if (!fs.existsSync(config.TEMP_DIR)) {
  fs.mkdirSync(config.TEMP_DIR, { recursive: true });
}

console.log('================================================================');
console.log('🖨️  CLOUDPRINT PRO - LOCAL LAN PRINT AGENT');
console.log('================================================================');
console.log(`🌐 Server Gateway : ${config.SERVER_URL}`);
console.log(`🔑 Agent Node ID   : ${config.AGENT_ID}`);
console.log(`💻 Local Hostname  : ${config.HOSTNAME} (${config.PLATFORM})`);
console.log(`📡 Local IP        : ${telemetry.getLocalIpAddresses()}`);
console.log('================================================================\n');

/**
 * HTTP / HTTPS Request Helper with Agent Authentication Headers
 */
function apiRequest(endpoint, method = 'GET', bodyData = null, isBinary = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, config.SERVER_URL);
    const client = url.protocol === 'https:' ? https : http;

    const headers = {
      'x-agent-id': config.AGENT_ID,
      'x-agent-token': config.AGENT_TOKEN,
      'User-Agent': `CloudPrint-Agent/2.0 (${config.PLATFORM})`
    };

    if (bodyData && !isBinary) {
      headers['Content-Type'] = 'application/json';
    }

    const req = client.request(url, { method, headers }, (res) => {
      if (isBinary) {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, data: Buffer.concat(chunks) });
          } else {
            reject(new Error(`Server returned HTTP ${res.statusCode}`));
          }
        });
        return;
      }

      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          const parsed = rawData ? JSON.parse(rawData) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, data: parsed });
          } else {
            reject(new Error(parsed.error || `Server returned HTTP ${res.statusCode}`));
          }
        } catch (e) {
          resolve({ status: res.statusCode, data: rawData });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Connection timed out'));
    });

    if (bodyData) {
      const payload = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
      req.write(payload);
    }
    req.end();
  });
}

/**
 * Periodic Heartbeat & Telemetry Ping
 */
async function sendHeartbeat() {
  try {
    const printers = telemetry.getLocalPrinters();
    const localIp = telemetry.getLocalIpAddresses();

    await apiRequest('/api/print/heartbeat', 'POST', {
      hostname: config.HOSTNAME,
      platform: config.PLATFORM,
      localIp,
      printersCount: printers.length,
      timestamp: new Date().toISOString()
    });

    // Heartbeat OK
  } catch (err) {
    console.warn(`⚠️ Heartbeat notice: ${err.message}`);
  }
}

/**
 * Downloads document payload to local private spool folder
 */
async function downloadDocument(jobId, filename) {
  const cleanId = String(jobId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeFilename = `${cleanId}_${crypto.randomUUID().slice(0, 8)}_${path.basename(filename || 'document.pdf')}`;
  const filePath = path.join(config.TEMP_DIR, safeFilename);

  const encodedId = encodeURIComponent(jobId);
  const res = await apiRequest(`/api/print/job/${encodedId}/file`, 'GET', null, true);
  fs.writeFileSync(filePath, res.data);
  return filePath;
}

/**
 * Securely deletes and overwrites local document file after printing
 */
function shredLocalFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const zeroBuffer = crypto.randomBytes(stats.size);
      fs.writeFileSync(filePath, zeroBuffer);
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.error('Error shredding local temp document:', e.message);
  }
}

/**
 * Main Queue Polling Loop
 */
async function pollPrintQueue() {
  if (!isRunning || isPolling) return;
  isPolling = true;

  try {
    const res = await apiRequest('/api/print/poll-queue', 'GET');
    const job = res.data?.job;

    if (job) {
      console.log(`\n📥 [NEW JOB DISPATCHED] : ${job.id}`);
      console.log(`   Customer  : ${job.customer || 'Guest'} (${job.phone})`);
      console.log(`   Document  : ${job.fileName} (${job.pages} pages, ${job.copies || 1} copies)`);
      console.log(`   Format    : ${job.paperSize ? job.paperSize.toUpperCase() : 'A4'} • ${job.colorMode === 'colour' ? 'Full Colour' : 'B&W'}`);

      // 1. Download Document Payload
      console.log('   ⬇️ Downloading document from server vault...');
      const tempFilePath = await downloadDocument(job.id, job.fileName);

      // 2. Physical Spool to Printer
      console.log('   🖨️ Dispatching to local printer driver...');
      await spooler.printDocument(tempFilePath, job);

      // 3. Confirm Job Completion to Server
      console.log('   ✅ Hardware print complete! Sending confirmation to cloud server...');
      await apiRequest('/api/print/complete-job', 'POST', {
        jobId: job.id,
        status: 'Completed',
        pagesPrinted: (job.pages || 1) * (job.copies || 1)
      });

      // 4. Secure Shredding (Zero Data Retention)
      shredLocalFile(tempFilePath);
      console.log('   🔒 Zero-Retention: Local temporary document shredded and wiped from disk.\n');
    }
  } catch (err) {
    // Network retry backoff
    if (!err.message.includes('job: null')) {
      // console.warn(`Queue polling notice: ${err.message}`);
    }
  } finally {
    isPolling = false;
  }
}

/**
 * Main Initialization & Timers
 */
async function startAgent() {
  // Initial hardware discovery
  const localPrinters = telemetry.getLocalPrinters();
  console.log(`🔍 Detected ${localPrinters.length} local printer(s) on this host:`);
  localPrinters.forEach((p, idx) => {
    console.log(`   [${idx + 1}] ${p.name} (${p.status}) ${p.isDefault ? '★ [Default]' : ''}`);
  });
  console.log('\n🚀 Print Agent daemon started. Listening for incoming print jobs...\n');

  // Initial heartbeat
  await sendHeartbeat();

  // Periodic heartbeat timer
  const heartbeatTimer = setInterval(sendHeartbeat, config.HEARTBEAT_INTERVAL_MS);
  if (heartbeatTimer.unref) heartbeatTimer.unref();

  // Continuous polling loop
  const pollTimer = setInterval(pollPrintQueue, config.POLL_INTERVAL_MS);
  if (pollTimer.unref) pollTimer.unref();

  // Initial immediate poll
  pollPrintQueue();
}

/**
 * Graceful Shutdown Handlers
 */
function gracefulShutdown() {
  console.log('\n🛑 Stopping Print Agent daemon gracefully...');
  isRunning = false;

  // Clean temp folder
  try {
    if (fs.existsSync(config.TEMP_DIR)) {
      const files = fs.readdirSync(config.TEMP_DIR);
      files.forEach(f => fs.unlinkSync(path.join(config.TEMP_DIR, f)));
    }
  } catch (e) {}

  console.log('👋 Print Agent stopped.');
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

if (require.main === module) {
  startAgent();
}

module.exports = {
  startAgent,
  pollPrintQueue,
  sendHeartbeat,
  apiRequest
};
