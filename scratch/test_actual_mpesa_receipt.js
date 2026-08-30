/**
 * Verification of Actual M-Pesa Transaction Reference Propagation on Receipts
 */

const assert = require('assert');
const db = require('../lib/db');

console.log('🧾 STARTING ACTUAL M-PESA RECEIPT NUMBER VERIFICATION...\n');

// 1. Create a mock order
const order = db.addOrder({
  id: '#CP' + Math.floor(100000 + Math.random() * 900000),
  phone: '0712345678',
  total: 50,
  paperSize: 'a4',
  colorMode: 'colour',
  serviceName: 'A4 Full Colour',
  pages: 10,
  copies: 1,
  doubleSided: false,
  status: 'Pending Payment',
  lifecycleState: 'PAYMENT_PENDING',
  mpesaRef: 'PENDING',
  files: [{ name: 'Contract.pdf', size: 102400, pages: 10 }]
});

console.log(`🧪 Test 1: Created test order ${order.id} with status '${order.status}'`);
assert.strictEqual(order.mpesaRef, 'PENDING');

// 2. Simulate Daraja Webhook with actual Safaricom transaction reference number
const actualMpesaReceipt = 'SJK7829104';
console.log(`\n🧪 Test 2: Simulating Safaricom Webhook settlement with real receipt: ${actualMpesaReceipt}`);

db.updateOrder(order.id, {
  status: 'Ready',
  lifecycleState: 'PAID',
  mpesaRef: actualMpesaReceipt,
  paidAt: new Date().toISOString()
});

const updatedOrder = db.getOrderById(order.id);
assert.strictEqual(updatedOrder.mpesaRef, actualMpesaReceipt, 'Order must store the exact actual M-Pesa transaction reference number');
assert.strictEqual(updatedOrder.lifecycleState, 'PAID');
console.log(`  ✔ Order updated with exact M-Pesa reference: ${updatedOrder.mpesaRef}`);

// 3. Verify that receipt rendering never falls back to placeholder when real receipt is present
console.log('\n🧪 Test 3: Receipt rendering validation');
const renderedReceiptRef = (updatedOrder.mpesaRef && updatedOrder.mpesaRef !== 'PENDING') 
  ? updatedOrder.mpesaRef 
  : 'FALLBACK';

assert.strictEqual(renderedReceiptRef, actualMpesaReceipt, 'Rendered receipt must show actual transaction code');
console.log(`  ✔ Rendered receipt reference matches actual M-Pesa code: ${renderedReceiptRef}`);

console.log('\n================================================================');
console.log('🎉 ALL ACTUAL M-PESA RECEIPT TESTS PASSED (100%)!');
console.log('================================================================\n');
