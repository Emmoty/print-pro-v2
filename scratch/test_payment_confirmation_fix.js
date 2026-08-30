const assert = require('assert');
const http = require('http');
const db = require('../lib/db');
const mpesa = require('../lib/mpesa');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: body ? JSON.parse(body) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Payment Confirmation Fix Verification Suite...\n');

  // Test 1: Order Creation and STK Push Initiation
  console.log('🧪 Step 1: Create Order and Dispatch STK Push');
  const createRes = await request({ path: '/api/orders/create', method: 'POST' }, {
    files: [{ name: 'Test_Fix_Doc.pdf', pages: 3, size: 20480 }],
    paperSize: 'a4',
    colorMode: 'bw',
    copies: 1,
    phone: '254712345678'
  });

  assert.strictEqual(createRes.status, 200);
  const jobId = createRes.body.order.id;
  console.log(`  ✔ Created order ${jobId}`);

  const stkRes = await request({ path: '/api/payments/stk-push', method: 'POST' }, {
    jobId,
    phone: '254712345678',
    amount: 9
  });
  assert.strictEqual(stkRes.status, 200);
  assert.strictEqual(stkRes.body.status, 'pending');
  console.log(`  ✔ Dispatched STK Push for ${jobId} (CheckoutRequestID: ${stkRes.body.checkout_request_id})`);

  // Test 2: Status check triggers non-blocking Daraja background query and settles payment
  console.log('\n🧪 Step 2: Query /api/payments/:jobId/status and verify resolution');
  // First status check (initiates background query)
  const statusRes1 = await request({ path: `/api/payments/${encodeURIComponent(jobId)}/status` });
  assert.strictEqual(statusRes1.status, 200);
  console.log(`  ✔ Status endpoint responds instantly: status = ${statusRes1.body.status}`);

  // Wait 100ms for background query to settle
  await new Promise(r => setTimeout(r, 200));

  // Second status check (should be settled as PAID)
  const statusRes2 = await request({ path: `/api/payments/${encodeURIComponent(jobId)}/status` });
  assert.strictEqual(statusRes2.status, 200);
  assert.strictEqual(statusRes2.body.paid, true);
  assert.strictEqual(statusRes2.body.status, 'PAID');
  assert.ok(statusRes2.body.mpesa_receipt_number, 'Must contain authoritative M-Pesa receipt');
  assert.ok(statusRes2.body.mpesa_receipt_number.startsWith('UHUF'), 'Receipt must start with UHUF');
  console.log(`  ✔ Payment confirmed seamlessly without hanging: M-Pesa Code = ${statusRes2.body.mpesa_receipt_number}`);

  // Test 3: Manual Code Verification Endpoint (POST /api/payments/verify-code)
  console.log('\n🧪 Step 3: Test Manual Code Verification (/api/payments/verify-code)');
  const createRes2 = await request({ path: '/api/orders/create', method: 'POST' }, {
    files: [{ name: 'Manual_Verify.pdf', pages: 5, size: 30720 }],
    paperSize: 'a4',
    colorMode: 'bw',
    copies: 1,
    phone: '0799999999'
  });
  const orderId2 = createRes2.body.order.id;

  const manualVerifyRes = await request({ path: '/api/payments/verify-code', method: 'POST' }, {
    jobId: orderId2,
    code: 'UHUF99XYZ8',
    phone: '0799999999'
  });

  assert.strictEqual(manualVerifyRes.status, 200);
  assert.strictEqual(manualVerifyRes.body.paid, true);
  assert.strictEqual(manualVerifyRes.body.mpesa_receipt_number, 'UHUF99XYZ8');

  const checkStatusRes2 = await request({ path: `/api/payments/${encodeURIComponent(orderId2)}/status` });
  assert.strictEqual(checkStatusRes2.status, 200);
  assert.strictEqual(checkStatusRes2.body.paid, true);
  assert.strictEqual(checkStatusRes2.body.mpesa_receipt_number, 'UHUF99XYZ8');
  console.log(`  ✔ Manual verification successfully confirmed Job ${orderId2} with code 'UHUF99XYZ8'`);

  // Test 4: Immediate On-Demand Query Endpoint (POST /api/payments/query-now)
  console.log('\n🧪 Step 4: Test On-Demand Query (/api/payments/query-now)');
  const createRes3 = await request({ path: '/api/orders/create', method: 'POST' }, {
    files: [{ name: 'OnDemand_Query.pdf', pages: 2, size: 15360 }],
    paperSize: 'a4',
    colorMode: 'colour',
    copies: 1,
    phone: '0788888888'
  });
  const orderId3 = createRes3.body.order.id;

  await request({ path: '/api/payments/stk-push', method: 'POST' }, {
    jobId: orderId3,
    phone: '0788888888',
    amount: 15
  });

  const queryNowRes = await request({ path: '/api/payments/query-now', method: 'POST' }, {
    jobId: orderId3
  });

  assert.strictEqual(queryNowRes.status, 200);
  assert.strictEqual(queryNowRes.body.paid, true);
  assert.ok(queryNowRes.body.mpesa_receipt_number, 'Must return receipt code');
  console.log(`  ✔ On-demand query settled Job ${orderId3} with receipt '${queryNowRes.body.mpesa_receipt_number}'`);

  console.log('\n🎉 ALL 4 PAYMENT CONFIRMATION FIX TESTS PASSED (100%)!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
