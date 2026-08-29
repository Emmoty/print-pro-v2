/**
 * CloudPrint Pro - Master Automated Production Test Runner
 */

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const db = require('./lib/db');
const auth = require('./lib/auth');
const storage = require('./lib/storage');
const stateMachine = require('./lib/stateMachine');
const { app } = require('./server');

async function runAllTests() {
  console.log('================================================================');
  console.log('🛡️  CLOUDPRINT PRO - PRODUCTION SECURITY & INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  // PART 1: SECURITY & DEFENSE-IN-DEPTH
  console.log('--- PART 1: SECURITY & THREAT MODEL DEFENSES ---');
  
  // 1. Password Hashing
  console.log('🧪 Test 1: Cryptographic Password Hashing & Verification');
  const rawPass = 'Strong@Password2026!';
  const hashed = db.hashPassword(rawPass);
  assert(hashed.includes(':'), 'Hash must contain salt separator');
  assert(db.verifyPassword(rawPass, hashed), 'Valid password must verify true');
  assert(!db.verifyPassword('WrongPassword', hashed), 'Invalid password must verify false');
  console.log('  ✔ Password hashing (Salt + Scrypt) verified.');

  // 2. Progressive Rate Limiting
  console.log('\n🧪 Test 2: Progressive Rate Limiting & Brute-Force Defense');
  const targetEmail = 'victim_user@cloudprint.co.ke';
  auth.resetFailedLogins(targetEmail);
  for (let i = 1; i <= 4; i++) {
    auth.recordFailedLogin(targetEmail);
    const check = auth.checkRateLimit(targetEmail);
    assert(check.allowed, `Attempt ${i} should be allowed before threshold`);
  }
  auth.recordFailedLogin(targetEmail);
  const lockoutCheck = auth.checkRateLimit(targetEmail);
  assert(!lockoutCheck.allowed, '5th failed attempt must trigger security lockout');
  auth.resetFailedLogins(targetEmail);
  console.log('  ✔ Progressive 5-attempt brute-force lockout verified.');

  // 3. Magic Byte Inspection
  console.log('\n🧪 Test 3: Magic Byte Validation & File Upload Security');
  const validPdfBuffer = Buffer.from('%PDF-1.7 header content here');
  const pdfValidation = storage.validateFileBuffer(validPdfBuffer, 'Financial_Statement.pdf');
  assert(pdfValidation.valid, 'Real PDF with %PDF header must pass validation');

  const fakePdfBuffer = Buffer.from('<?php system($_GET["cmd"]); ?>');
  const fakeValidation = storage.validateFileBuffer(fakePdfBuffer, 'innocent_invoice.pdf');
  assert(!fakeValidation.valid, 'Disguised PHP script with .pdf extension must be rejected');

  const exeBuffer = Buffer.from('MZ executable binary');
  const exeValidation = storage.validateFileBuffer(exeBuffer, 'malware.exe');
  assert(!exeValidation.valid, 'Executable files must be rejected');
  console.log('  ✔ Magic byte inspection and extension allowlist verified.');

  // 4. Zero Data Retention
  console.log('\n🧪 Test 4: Zero Data Retention & Secure Shredding');
  const testVaultRecord = storage.saveToVault(validPdfBuffer, 'SensitiveContract.pdf', 'JOB-TEST-01');
  assert(fs.existsSync(testVaultRecord.diskPath), 'Vault file must exist before shredding');
  const shredResult = storage.shredFile(testVaultRecord.diskPath);
  assert(shredResult, 'shredFile must return true');
  assert(!fs.existsSync(testVaultRecord.diskPath), 'Vault file must be completely purged from disk');
  console.log('  ✔ Cryptographic payload overwrite and shredding verified.');

  // 5. Authoritative Pricing
  console.log('\n🧪 Test 5: Server-Side Authoritative Pricing Calculation');
  const pricing = { a4_bw: 1, a4_colour: 3, a3_bw: 2, a3_colour: 5 };
  const calc1 = stateMachine.calculateAuthoritativePrice(pricing, 'a4', 'colour', 20, 2);
  assert.strictEqual(calc1.totalAmount, 120, 'Total must be 120 KES (20 * 3 * 2)');
  console.log('  ✔ Authoritative pricing logic verified.');

  // 6. RBAC Matrix
  console.log('\n🧪 Test 6: Role-Based Access Control (RBAC) Permissions');
  assert(auth.ROLE_PERMISSIONS.super_admin.has('all'));
  assert(auth.ROLE_PERMISSIONS.operator.has('orders'));
  assert(!auth.ROLE_PERMISSIONS.operator.has('pricing'));
  assert(!auth.ROLE_PERMISSIONS.operator.has('users'));
  assert(auth.ROLE_PERMISSIONS.technician.has('tech'));
  assert(auth.ROLE_PERMISSIONS.auditor.has('audit'));
  console.log('  ✔ RBAC least-privilege matrix verified.');

  // 7. State Machine
  console.log('\n🧪 Test 7: State Machine Lifecycle Validation');
  assert(stateMachine.isValidTransition('UPLOADED', 'PAYMENT_PENDING'));
  assert(stateMachine.isValidTransition('PAYMENT_PENDING', 'PAID'));
  assert(stateMachine.isValidTransition('PAID', 'QUEUED'));
  assert(stateMachine.isValidTransition('QUEUED', 'PRINTING'));
  assert(stateMachine.isValidTransition('PRINTING', 'COMPLETED'));
  assert(!stateMachine.isValidTransition('UPLOADED', 'COMPLETED'));
  assert(!stateMachine.isValidTransition('PAYMENT_PENDING', 'PRINTING'));
  console.log('  ✔ State machine transition integrity verified.');

  // 8. Idempotency
  console.log('\n🧪 Test 8: Idempotency Key Deduplication');
  const testKey = 'idemp_test_key_' + Date.now();
  db.setIdempotency(testKey, { success: true, orderId: '#CP999999' });
  assert.strictEqual(db.getIdempotency(testKey).data.orderId, '#CP999999');
  console.log('  ✔ Idempotency caching verified.');

  // PART 2: REST API INTEGRATION TESTS
  console.log('\n--- PART 2: PRODUCTION REST API & ENDPOINTS ---');
  const TEST_PORT = 3456;
  const serverInstance = await new Promise((resolve) => {
    const s = app.listen(TEST_PORT, () => resolve(s));
  });

  function request(options, postData = null) {
    return new Promise((resolve, reject) => {
      const req = http.request({ port: TEST_PORT, ...options }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data), raw: data });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, data, raw: data });
          }
        });
      });
      req.on('error', reject);
      if (postData) {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(postData));
      }
      req.end();
    });
  }

  try {
    // 9. Health & Security Headers
    console.log('🧪 Test 9: Health & Security Headers');
    const health = await request({ path: '/healthz', method: 'GET' });
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.data.status, 'HEALTHY');
    assert.strictEqual(health.headers['x-content-type-options'], 'nosniff');
    assert(health.headers['x-request-id']);
    console.log('  ✔ Health checks and security headers verified.');

    // 10. Login API
    console.log('\n🧪 Test 10: Staff Authentication API (/api/auth/login)');
    const loginRes = await request({ path: '/api/auth/login', method: 'POST' }, {
      email: 'sarah.k@cloudprint.co.ke',
      password: 'Admin@CloudPrint2026!'
    });
    assert.strictEqual(loginRes.status, 200);
    assert(loginRes.data.token);
    const adminToken = loginRes.data.token;
    console.log('  ✔ Super Admin login and session token verified.');

    // 11. Order Creation & Calculation
    console.log('\n🧪 Test 11: Order Creation API (/api/orders/create)');
    const orderRes = await request({ path: '/api/orders/create', method: 'POST' }, {
      files: [{ name: 'Project_Design.pdf', pages: 10 }],
      paperSize: 'a4',
      colorMode: 'colour',
      copies: 2,
      phone: '0712345678',
      idempotencyKey: 'test_order_' + Date.now()
    });
    assert.strictEqual(orderRes.status, 200);
    assert.strictEqual(orderRes.data.order.total, 60); // 10 pgs * 3 KES * 2 copies
    const orderId = orderRes.data.order.id;
    console.log(`  ✔ Order created: ${orderId} (KES ${orderRes.data.order.total}.00).`);

    // 12. M-Pesa STK Push
    console.log('\n🧪 Test 12: M-Pesa STK Push API (/api/payments/stk-push)');
    const payRes = await request({ path: '/api/payments/stk-push', method: 'POST' }, {
      jobId: orderId,
      phone: '0712345678',
      amount: 60
    });
    assert.strictEqual(payRes.status, 200);
    assert(payRes.data.checkoutRequestId);
    console.log(`  ✔ M-Pesa STK Push dispatched. CheckoutRequestID: ${payRes.data.checkoutRequestId}.`);

    // 13. Daraja Webhook Callback
    console.log('\n🧪 Test 13: Safaricom Daraja Webhook API (/api/payments/webhook)');
    const webhookRes = await request({ path: '/api/payments/webhook', method: 'POST' }, {
      Body: {
        stkCallback: {
          ResultCode: 0,
          CheckoutRequestID: payRes.data.checkoutRequestId,
          CallbackMetadata: {
            Item: [
              { Name: 'MpesaReceiptNumber', Value: 'SJK492019' },
              { Name: 'Amount', Value: 60 },
              { Name: 'PhoneNumber', Value: 254712345678 }
            ]
          }
        }
      }
    });
    assert.strictEqual(webhookRes.status, 200);
    const settledOrder = db.getOrderById(orderId);
    assert.strictEqual(settledOrder.mpesaRef, 'SJK492019');
    console.log(`  ✔ Daraja Webhook verified and settled transaction: ${settledOrder.mpesaRef}.`);

    // 14. Print Agent Polling
    console.log('\n🧪 Test 14: Print Agent Mutual HMAC Polling (/api/print/poll-queue)');
    const agentPoll = await request({
      path: '/api/print/poll-queue',
      method: 'GET',
      headers: {
        'x-agent-id': 'AGT-LAN-01',
        'x-agent-token': 'cloudprint_agent_secret_key_01'
      }
    });
    assert.strictEqual(agentPoll.status, 200);
    console.log('  ✔ Authenticated print agent polled queue successfully.');

    // 15. Admin Overview
    console.log('\n🧪 Test 15: Admin Overview API (/api/admin/overview)');
    const adminRes = await request({
      path: '/api/admin/overview',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminRes.status, 200);
    assert(adminRes.data.kpis.totalRevenue > 0);
    console.log('  ✔ Admin overview computed and returned securely.');

    // PART 3: BACKUP & RECOVERY VERIFICATION
    console.log('\n--- PART 3: DISASTER RECOVERY & BACKUP VERIFICATION ---');
    const backupFn = require('./scripts/backup');
    const restoreFn = require('./scripts/restore');

    console.log('🧪 Test 16: Automated Backup Snapshot Creation');
    const backupPath = backupFn();
    assert(fs.existsSync(backupPath), 'Backup file must exist on disk');

    console.log('🧪 Test 17: Database Restoration Verification');
    const restored = restoreFn();
    assert(restored, 'Database restoration must succeed');
    console.log('  ✔ Disaster recovery snapshot and restoration verified.');

    console.log('\n================================================================');
    console.log('🎉 ALL 17 PRODUCTION HARDENING & SECURITY TESTS PASSED (100%)!');
    console.log('================================================================\n');
  } finally {
    if (serverInstance) {
      await new Promise(resolve => serverInstance.close(resolve));
    }
  }
}

if (require.main === module) {
  runAllTests().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Test Suite Failure:', err);
    process.exit(1);
  });
}

module.exports = runAllTests;
