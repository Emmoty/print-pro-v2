/**
 * CloudPrint Pro - Print Agent & Hardware Dispatcher Automated Verification Suite
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const { app } = require('../server');
const db = require('../lib/db');
const agent = require('../agent/index');
const config = require('../agent/config');
const telemetry = require('../agent/telemetry');
const spooler = require('../agent/spooler');

const TEST_PORT = 3567;
let serverInstance;

async function runAgentTests() {
  console.log('🖨️  STARTING LOCAL LAN PRINT AGENT VERIFICATION SUITE...\n');

  // Override agent server URL to point to local test port
  config.SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;

  // Start HTTP server on test port
  await new Promise(resolve => {
    serverInstance = app.listen(TEST_PORT, () => resolve());
  });

  try {
    // 1. Hardware Telemetry & Discovery
    console.log('🧪 Test 1: Hardware Discovery & Local Network IP Detection');
    const printers = telemetry.getLocalPrinters();
    assert(Array.isArray(printers), 'Printers must return array');
    console.log(`  ✔ Found ${printers.length} local printer(s): [${printers.map(p => p.name).join(', ')}]`);

    const localIp = telemetry.getLocalIpAddresses();
    assert(typeof localIp === 'string' && localIp.length > 0, 'Must detect local IP');
    console.log(`  ✔ Detected local LAN IP: ${localIp}`);

    // 2. Heartbeat Ping
    console.log('\n🧪 Test 2: Agent Heartbeat & Mutual HMAC Authentication');
    const heartbeatRes = await agent.apiRequest('/api/print/heartbeat', 'POST', {
      hostname: config.HOSTNAME,
      platform: config.PLATFORM,
      localIp
    });
    assert.strictEqual(heartbeatRes.status, 200, 'Heartbeat must return 200');
    assert.strictEqual(heartbeatRes.data.status, 'online');
    console.log('  ✔ Agent heartbeat verified and accepted by cloud server.');

    // 3. Printer Route Resolution
    console.log('\n🧪 Test 3: Spooler Printer Capability Route Resolution');
    const resolvedA4 = spooler.resolvePrinterName({ paperSize: 'a4', colorMode: 'bw' });
    const resolvedA3 = spooler.resolvePrinterName({ paperSize: 'a3', colorMode: 'colour' });
    console.log(`  ✔ Resolved A4 B&W: ${resolvedA4 || 'Default'}, A3 Colour: ${resolvedA3 || 'Default'}`);

    // 4. Create and Dispatch Job End-to-End
    console.log('\n🧪 Test 4: End-to-End Print Dispatch, Download & Confirmation');
    const testJobId = '#CP' + Math.floor(100000 + Math.random() * 900000);
    db.addOrder({
      id: testJobId,
      customer: 'Test Agent User',
      phone: '0712345678',
      fileName: 'Blueprint_Architectural.pdf',
      files: [{ name: 'Blueprint_Architectural.pdf', pages: 5 }],
      serviceName: 'A3 Colour',
      paperSize: 'a3',
      colorMode: 'colour',
      pages: 5,
      copies: 1,
      total: 25,
      status: 'Ready',
      lifecycleState: 'PAID',
      mpesaRef: 'SJK889911',
      timestamp: new Date().toISOString(),
      filePurged: false
    });

    // Run agent queue poll
    await agent.pollPrintQueue();

    // Verify order updated in DB
    const updatedOrder = db.getOrderById(testJobId);
    assert(updatedOrder, 'Order must exist');
    assert.strictEqual(updatedOrder.status, 'Completed', 'Order status must be Completed');
    assert.strictEqual(updatedOrder.lifecycleState, 'COMPLETED', 'Lifecycle state must be COMPLETED');
    assert.strictEqual(updatedOrder.filePurged, true, 'Zero-Retention: Payload must be marked purged');
    console.log(`  ✔ Job ${testJobId} spooled, printed, confirmed, and purged successfully!`);

    console.log('\n================================================================');
    console.log('🎉 ALL LOCAL LAN PRINT AGENT VERIFICATION TESTS PASSED (100%)!');
    console.log('================================================================\n');
  } finally {
    if (serverInstance) {
      await new Promise(resolve => serverInstance.close(resolve));
    }
  }
}

if (require.main === module) {
  runAgentTests().then(() => process.exit(0)).catch(err => {
    console.error('Agent Test Failure:', err);
    process.exit(1);
  });
}

module.exports = runAgentTests;
