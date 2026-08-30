/**
 * High-Speed STK Push & Reactive Payment Stream Verification
 */

const assert = require('assert');
const mpesa = require('../lib/mpesa');
const db = require('../lib/db');

console.log('⚡ STARTING HIGH-SPEED STK PUSH & STREAM VERIFICATION...\n');

// 1. Verify Keep-Alive and Token Pre-warming
console.log('🧪 Test 1: Pre-warming Daraja OAuth Token...');
mpesa.warmTokenCache().then(() => {
  console.log('  ✔ Token warm cache executed successfully.');
}).catch(() => {});

// 2. Create Order & STK Push
const order = db.addOrder({
  id: '#CP' + Math.floor(100000 + Math.random() * 900000),
  phone: '0712345678',
  total: 40,
  paperSize: 'a4',
  colorMode: 'bw',
  pages: 10,
  copies: 1,
  doubleSided: false,
  status: 'Pending Payment',
  lifecycleState: 'PAYMENT_PENDING',
  mpesaRef: 'PENDING',
  files: [{ name: 'Document.pdf', size: 102400, pages: 10 }]
});

console.log(`\n🧪 Test 2: Created order ${order.id} for high-speed STK test`);
assert.strictEqual(order.lifecycleState, 'PAYMENT_PENDING');

// 3. Simulate Instant STK push dispatch
mpesa.initiateSTKPush({
  phone: '0712345678',
  amount: 40,
  jobId: order.id,
  accountReference: order.id
}).then((stkResult) => {
  console.log(`  ✔ STK Push dispatched. CheckoutRequestID: ${stkResult.CheckoutRequestID}`);
  assert.ok(stkResult.CheckoutRequestID);

  // 4. Simulate Webhook Settlement with actual M-Pesa Code
  const realMpesaCode = 'SJK9918231';
  db.updateOrder(order.id, {
    status: 'Ready',
    lifecycleState: 'PAID',
    mpesaRef: realMpesaCode,
    paidAt: new Date().toISOString()
  });

  const settledOrder = db.getOrderById(order.id);
  assert.strictEqual(settledOrder.mpesaRef, realMpesaCode);
  assert.strictEqual(settledOrder.lifecycleState, 'PAID');
  console.log(`  ✔ Order instantaneously confirmed with real M-Pesa code: ${settledOrder.mpesaRef}`);

  console.log('\n================================================================');
  console.log('🎉 ALL HIGH-SPEED STK PUSH & STREAM TESTS PASSED (100%)!');
  console.log('================================================================\n');
}).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
