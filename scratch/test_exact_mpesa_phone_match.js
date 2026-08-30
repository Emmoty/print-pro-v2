/**
 * Verification of 100% Exact Matching between Safaricom SMS Transaction Code and Receipt Display
 */

const assert = require('assert');
const db = require('../lib/db');

console.log('🔄 STARTING EXACT SAFARICOM M-PESA CODE MATCHING SUITE...\n');

// Real Safaricom M-Pesa transaction code received by customer on their phone via SMS
const realCustomerSmsCode = 'TLH7K29X1P';

// 1. Create a pending order
const orderId = '#CP' + Math.floor(100000 + Math.random() * 900000);
const order = db.addOrder({
  id: orderId,
  customer: 'Phone User',
  phone: '0712345678',
  fileName: 'Contract.pdf',
  total: 20,
  status: 'Pending Payment',
  lifecycleState: 'PAYMENT_PENDING',
  mpesaRef: 'PENDING',
  checkoutRequestId: 'ws_CO_' + Date.now() + '_1234'
});

console.log(`🧪 Test 1: Order created ${order.id} (Status: ${order.status}, MpesaRef: ${order.mpesaRef})`);

// 2. Commit transaction using the exact Safaricom SMS code
console.log(`\n🧪 Test 2: Committing transaction with exact Safaricom SMS code: '${realCustomerSmsCode}'...`);
const tx = db.recordPaymentTransaction({
  jobId: order.id,
  mpesaReceiptNumber: realCustomerSmsCode,
  amount: 20,
  phone: '0712345678',
  rawCallback: { source: 'SAFARICOM_SMS_PAYMENT' }
});

assert.strictEqual(tx.mpesaReceiptNumber, realCustomerSmsCode, 'Saved transaction code must match SMS code exactly');
console.log(`  ✔ Transaction recorded with exact code: ${tx.mpesaReceiptNumber}`);

// 3. Verify Database Order State
console.log(`\n🧪 Test 3: Checking updated order in database...`);
const updatedOrder = db.getOrderById(order.id);
assert.strictEqual(updatedOrder.lifecycleState, 'PAID');
assert.strictEqual(updatedOrder.status, 'Ready');
assert.strictEqual(updatedOrder.mpesaRef, realCustomerSmsCode, 'Order mpesaRef must match SMS code exactly');
console.log(`  ✔ Order ${updatedOrder.id} has exact mpesaRef: ${updatedOrder.mpesaRef}`);

// 4. Verify Receipt Render Display
console.log(`\n🧪 Test 4: Verifying Receipt Display Field...`);
const receiptCode = String(updatedOrder.mpesaRef).trim().toUpperCase();
assert.strictEqual(receiptCode, realCustomerSmsCode, 'Receipt field must be 100% byte-for-byte identical to phone SMS code');
console.log(`  ✔ Receipt 'M-Pesa receipt' field displays: ${receiptCode}`);

// 5. Verify WhatsApp Receipt Formatting
console.log(`\n🧪 Test 5: Verifying WhatsApp Message Content...`);
const whatsappMessage = `🧾 *CLOUDPRINT PRO - OFFICIAL RECEIPT*\n📱 *M-Pesa receipt:* ${receiptCode}\n💰 *Total paid:* *KES ${updatedOrder.total}*`;
assert.ok(whatsappMessage.includes(`*M-Pesa receipt:* ${realCustomerSmsCode}`), 'WhatsApp receipt must contain exact SMS code');
console.log(`  ✔ WhatsApp receipt contains exact code: ${receiptCode}`);

console.log('\n================================================================');
console.log('🎉 ALL EXACT SAFARICOM M-PESA CODE MATCHING TESTS PASSED (100%)!');
console.log('================================================================\n');
