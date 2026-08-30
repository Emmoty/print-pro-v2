/**
 * Verification of Transaction Code Storage Before Receipt Generation Sequence
 */

const assert = require('assert');
const db = require('../lib/db');

console.log('🔄 STARTING TRANSACTION STORAGE SEQUENCE VERIFICATION...\n');

// 1. Create a pending test order
const testJobId = '#CP' + Math.floor(100000 + Math.random() * 900000);
const order = db.addOrder({
  id: testJobId,
  customer: 'Sequence Tester',
  phone: '0712345678',
  fileName: 'SequenceDoc.pdf',
  total: 15,
  status: 'Pending Payment',
  lifecycleState: 'PAYMENT_PENDING',
  mpesaRef: 'PENDING',
  checkoutRequestId: 'ws_CO_' + Date.now() + '_9988'
});

console.log(`🧪 Step 1: Pending order created: ${order.id} [Status: ${order.status}, MpesaRef: ${order.mpesaRef}]`);
assert.strictEqual(order.lifecycleState, 'PAYMENT_PENDING');
assert.strictEqual(order.mpesaRef, 'PENDING');

// 2. Simulate M-Pesa Webhook Callback Payload
console.log('\n🧪 Step 2: M-Pesa callback received...');
const rawCallbackPayload = {
  Body: {
    stkCallback: {
      MerchantRequestID: '29103-99210-' + Date.now(),
      CheckoutRequestID: order.checkoutRequestId,
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully.',
      CallbackMetadata: {
        Item: [
          { Name: 'Amount', Value: 15.00 },
          { Name: 'MpesaReceiptNumber', Value: 'UHUFW4ROHB' },
          { Name: 'TransactionDate', Value: 20260830144500 },
          { Name: 'PhoneNumber', Value: 254712345678 }
        ]
      }
    }
  }
};

// 3. Validate callback & Extract MpesaReceiptNumber
console.log('🧪 Step 3: Validating callback and extracting MpesaReceiptNumber...');
const items = rawCallbackPayload.Body.stkCallback.CallbackMetadata.Item;
let extractedReceipt = null;
items.forEach(item => {
  if (item.Name.toLowerCase() === 'mpesareceiptnumber') {
    extractedReceipt = String(item.Value).trim();
  }
});

assert.strictEqual(extractedReceipt, 'UHUFW4ROHB', 'Extracted receipt must match callback item');
console.log(`  ✔ Extracted MpesaReceiptNumber: ${extractedReceipt}`);

// 4. Save transaction & Commit database transaction
console.log('\n🧪 Step 4: Saving transaction to database...');
const txRecord = db.recordPaymentTransaction({
  jobId: order.id,
  mpesaReceiptNumber: extractedReceipt,
  amount: 15,
  phone: '254712345678',
  rawCallback: rawCallbackPayload
});

assert.ok(txRecord.id, 'Transaction record must be created');
assert.strictEqual(txRecord.mpesaReceiptNumber, 'UHUFW4ROHB');
assert.strictEqual(txRecord.status, 'SETTLED');
console.log(`  ✔ Transaction committed to database: ${txRecord.id} (Receipt: ${txRecord.mpesaReceiptNumber})`);

// 5. Verify database order state is marked PAID with transaction code committed
console.log('\n🧪 Step 5: Verifying order marked PAID in persistent database...');
const updatedOrder = db.getOrderById(order.id);
assert.strictEqual(updatedOrder.lifecycleState, 'PAID', 'Lifecycle must be PAID');
assert.strictEqual(updatedOrder.status, 'Ready', 'Status must be Ready');
assert.strictEqual(updatedOrder.mpesaRef, 'UHUFW4ROHB', 'Order mpesaRef must match saved transaction code');
assert.ok(updatedOrder.paidAt, 'paidAt timestamp must be recorded');
console.log(`  ✔ Order ${updatedOrder.id} successfully transitioned to [Status: ${updatedOrder.status}, Lifecycle: ${updatedOrder.lifecycleState}, M-Pesa: ${updatedOrder.mpesaRef}]`);

// 6. Generate Receipt Simulation (Only possible because mpesaRef is stored)
console.log('\n🧪 Step 6: Generating receipt with stored transaction code...');
const receiptPayload = {
  jobReference: updatedOrder.id.replace('#CP', 'JOB-'),
  paidAt: updatedOrder.paidAt,
  mpesaReceipt: updatedOrder.mpesaRef,
  totalPaid: `KES ${updatedOrder.total}`
};

assert.strictEqual(receiptPayload.mpesaReceipt, 'UHUFW4ROHB');
assert.strictEqual(receiptPayload.totalPaid, 'KES 15');
console.log(`  ✔ Receipt generated successfully:`);
console.log(`    • Job Reference : ${receiptPayload.jobReference}`);
console.log(`    • M-Pesa Code   : ${receiptPayload.mpesaReceipt}`);
console.log(`    • Total Paid    : ${receiptPayload.totalPaid}`);

console.log('\n================================================================');
console.log('🎉 TRANSACTION STORAGE & RECEIPT SEQUENCE TEST PASSED (100%)!');
console.log('================================================================\n');
