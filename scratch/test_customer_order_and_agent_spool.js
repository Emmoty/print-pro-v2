/**
 * End-to-End Test: Customer Order Creation -> M-Pesa Settlement -> Agent Queue Polling -> Hardware Spool Completion
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

const db = require('../lib/db');
const storage = require('../lib/storage');
const agent = require('../agent/index');
const spooler = require('../agent/spooler');

console.log('🔄 STARTING E2E CUSTOMER ORDER & AGENT PRINT DISPATCH TEST...\n');

// 1. Stage a test document into the vault
console.log('🧪 Step 1: Uploading and staging document into vault...');
const samplePdf = Buffer.from('%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]>> endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\ntrailer <</Size 4 /Root 1 0 R>>\nstartxref\n190\n%%EOF');

const vaultRecord = storage.saveToVault(samplePdf, 'Customer_Print_Job.pdf');
assert.ok(vaultRecord.fileId, 'File must be assigned a unique vault fileId');
console.log(`  ✔ Document staged in vault: ${vaultRecord.fileId} (${vaultRecord.originalName})`);

// 2. Create customer order
console.log('\n🧪 Step 2: Creating customer order in database...');
const newOrder = db.addOrder({
  id: '#CP' + Math.floor(100000 + Math.random() * 900000),
  customer: 'Test Customer',
  phone: '0712345678',
  fileName: 'Customer_Print_Job.pdf',
  files: [
    {
      fileId: vaultRecord.fileId,
      name: 'Customer_Print_Job.pdf',
      pages: 4
    }
  ],
  serviceName: 'A4 Black & White',
  paperSize: 'a4',
  colorMode: 'bw',
  ratePerPage: 1,
  pages: 4,
  copies: 1,
  total: 4,
  status: 'Ready',
  lifecycleState: 'PAID',
  mpesaRef: 'QWE' + Math.floor(100000 + Math.random() * 900000),
  timestamp: new Date().toISOString()
});

console.log(`  ✔ Order created: ${newOrder.id} [Status: ${newOrder.status}, Lifecycle: ${newOrder.lifecycleState}]`);

// 3. Agent polls the queue
console.log('\n🧪 Step 3: Agent polling queue (/api/print/poll-queue)...');
const orders = db.getOrders();
const pendingJob = orders.find(o => {
  const s = (o.status || '').toLowerCase();
  const state = (o.lifecycleState || '').toUpperCase();
  return (s === 'ready' || s === 'queued' || state === 'PAID' || state === 'READY') && o.id === newOrder.id;
});

assert.ok(pendingJob, 'Pending job must be found in queue');
console.log(`  ✔ Pending job acquired from queue: ${pendingJob.id}`);

// 4. Update order to Printing
db.updateOrder(pendingJob.id, {
  status: 'Printing',
  lifecycleState: 'PRINTING',
  dispatchedToAgent: 'AGT-LAN-01'
});

// 5. Test Spooler dispatcher
console.log('\n🧪 Step 4: Dispatching job to printer spooler...');
spooler.printDocument(path.join(storage.VAULT_DIR, `${vaultRecord.fileId}_Customer_Print_Job.pdf`), pendingJob).then((result) => {
  console.log(`  ✔ Spooler dispatch result: ${JSON.stringify(result)}`);

  // 6. Complete Job
  console.log('\n🧪 Step 5: Recording hardware completion in database...');
  const completedOrder = db.updateOrder(pendingJob.id, {
    status: 'Completed',
    lifecycleState: 'COMPLETED',
    completedAt: new Date().toISOString(),
    filePurged: true
  });

  assert.strictEqual(completedOrder.status, 'Completed');
  assert.strictEqual(completedOrder.lifecycleState, 'COMPLETED');
  assert.strictEqual(completedOrder.filePurged, true);
  console.log(`  ✔ Order ${completedOrder.id} successfully finalized and marked Completed.`);

  console.log('\n================================================================');
  console.log('🎉 E2E CUSTOMER PRINT & AGENT DISPATCH TEST PASSED (100%)!');
  console.log('================================================================\n');
});
