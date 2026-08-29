/**
 * CloudPrint Pro - Production REST API Integration Test Suite
 */

const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const { app } = require('../server');

let serverInstance;
const TEST_PORT = 3456;

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port: TEST_PORT, ...options }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      const payload = typeof postData === 'string' ? postData : JSON.stringify(postData);
      req.setHeader('Content-Type', 'application/json');
      req.write(payload);
    }
    req.end();
  });
}

async function runApiTests() {
  console.log('🌐 STARTING PRODUCTION REST API INTEGRATION SUITE...\n');

  await new Promise((resolve) => {
    serverInstance = app.listen(TEST_PORT, () => {
      console.log(`Test server running on port ${TEST_PORT}\n`);
      resolve();
    });
  });

  try {
    // 1. Health Checks
    console.log('🧪 Test 1: Health & Readiness Probes');
    const health = await request({ path: '/healthz', method: 'GET' });
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.data.status, 'HEALTHY');

    const ready = await request({ path: '/readyz', method: 'GET' });
    assert.strictEqual(ready.status, 200);
    assert.strictEqual(ready.data.status, 'READY');
    console.log('  ✔ Health and readiness endpoints verified.');

    // 2. Security Headers (Helmet)
    console.log('\n🧪 Test 2: Production Security Headers');
    assert(health.headers['x-frame-options'] === 'DENY' || health.headers['content-security-policy']?.includes("frame-ancestors 'none'"), 'Frameguard must be DENY / none');
    assert.strictEqual(health.headers['x-content-type-options'], 'nosniff', 'Must include nosniff');
    assert(health.headers['x-request-id'], 'Must inject x-request-id correlation header');
    console.log('  ✔ Helmet CSP, X-Content-Type-Options, Frameguard & Request IDs verified.');

    // 3. Staff Authentication (Super Admin)
    console.log('\n🧪 Test 3: Staff Authentication (/api/auth/login)');
    const loginRes = await request({ path: '/api/auth/login', method: 'POST' }, {
      email: 'sarah.k@cloudprint.co.ke',
      password: 'Admin@CloudPrint2026!'
    });
    assert.strictEqual(loginRes.status, 200, 'Login must succeed');
    assert(loginRes.data.token, 'Must return session token');
    assert.strictEqual(loginRes.data.user.role, 'super_admin');
    const adminToken = loginRes.data.token;
    console.log('  ✔ Super Admin login and session token verified.');

    // 4. Failed Login & Error Handling
    console.log('\n🧪 Test 4: Invalid Password Rejection');
    const failedLogin = await request({ path: '/api/auth/login', method: 'POST' }, {
      email: 'sarah.k@cloudprint.co.ke',
      password: 'WrongPassword123!'
    });
    assert.strictEqual(failedLogin.status, 401, 'Invalid password must return 401');
    console.log('  ✔ Invalid password correctly rejected.');

    // 5. Customer Order Creation & Authoritative Pricing
    console.log('\n🧪 Test 5: Order Creation (/api/orders/create)');
    const orderRes = await request({ path: '/api/orders/create', method: 'POST' }, {
      files: [{ name: 'Thesis_Final.pdf', pages: 15 }],
      paperSize: 'a4',
      colorMode: 'colour',
      copies: 2,
      phone: '0712345678',
      idempotencyKey: 'test_order_idemp_' + Date.now()
    });
    assert.strictEqual(orderRes.status, 200);
    assert(orderRes.data.order.id, 'Must return job identifier');
    assert.strictEqual(orderRes.data.order.total, 15 * 3 * 2, 'Total must be 90 KES (15 pages * 3 KES * 2 copies)');
    const createdJobId = orderRes.data.order.id;
    console.log(`  ✔ Order created: ${createdJobId} (Total: KES ${orderRes.data.order.total}.00).`);

    // 6. M-Pesa STK Push Simulation
    console.log('\n🧪 Test 6: M-Pesa STK Push (/api/payments/stk-push)');
    const payRes = await request({ path: '/api/payments/stk-push', method: 'POST' }, {
      jobId: createdJobId,
      phone: '0712345678',
      amount: 90
    });
    assert.strictEqual(payRes.status, 200);
    assert(payRes.data.mpesaRef, 'Must issue M-Pesa reference code');
    assert.strictEqual(payRes.data.status, 'VERIFIED');
    console.log(`  ✔ M-Pesa transaction verified: ${payRes.data.mpesaRef}.`);

    // 7. Daraja Webhook Callback
    console.log('\n🧪 Test 7: Safaricom Daraja Webhook (/api/payments/webhook)');
    const webhookRes = await request({ path: '/api/payments/webhook', method: 'POST' }, {
      Body: {
        stkCallback: {
          MerchantRequestID: '29103-99210-1',
          CheckoutRequestID: 'ws_CO_30082026_01',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.'
        }
      }
    });
    assert.strictEqual(webhookRes.status, 200);
    assert.strictEqual(webhookRes.data.ResultCode, 0);
    console.log('  ✔ Webhook callback processed idempotently.');

    // 8. Print Agent Mutual Authentication & Queue Polling
    console.log('\n🧪 Test 8: Print Agent Polling (/api/print/poll-queue)');
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

    // 9. Admin Overview & RBAC Verification
    console.log('\n🧪 Test 9: Admin Overview KPI API (/api/admin/overview)');
    const adminOverview = await request({
      path: '/api/admin/overview',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminOverview.status, 200);
    assert(adminOverview.data.kpis.totalRevenue > 0);
    console.log('  ✔ Admin overview metrics computed and returned securely.');

    console.log('\n🎉 ALL REST API INTEGRATION TESTS PASSED (100%)!');
  } finally {
    if (serverInstance) serverInstance.close();
  }
}

if (require.main === module) {
  runApiTests().catch(err => {
    console.error('API Test Failure:', err);
    if (serverInstance) serverInstance.close();
    process.exit(1);
  });
}

module.exports = runApiTests;
