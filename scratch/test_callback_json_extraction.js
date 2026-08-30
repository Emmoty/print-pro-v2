/**
 * Verification of M-Pesa Transaction Code Extraction from Callback JSON
 */

const assert = require('assert');

console.log('🔄 STARTING CALLBACK JSON TRANSACTION CODE EXTRACTION TESTS...\n');

// 1. Standard Safaricom Daraja STK Push Callback JSON
const stkCallbackJson = {
  Body: {
    stkCallback: {
      MerchantRequestID: '29115-34620561-1',
      CheckoutRequestID: 'ws_CO_191220261020362925',
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully.',
      CallbackMetadata: {
        Item: [
          { Name: 'Amount', Value: 10.00 },
          { Name: 'MpesaReceiptNumber', Value: 'TLH7K29X1P' },
          { Name: 'Balance' },
          { Name: 'TransactionDate', Value: 20260830153000 },
          { Name: 'PhoneNumber', Value: 254712345678 }
        ]
      }
    }
  }
};

// 2. C2B Validation / Confirmation JSON
const c2bCallbackJson = {
  TransactionType: 'Pay Bill',
  TransID: 'UHUFN4R0HB',
  TransTime: '20260830153000',
  TransAmount: '15.00',
  BusinessShortCode: '174379',
  BillRefNumber: 'JOB-99210',
  MSISDN: '254712345678'
};

// 3. Flattened Callback Structure
const flattenedCallbackJson = {
  stkCallback: {
    CheckoutRequestID: 'ws_CO_892102_99',
    ResultCode: 0,
    CallbackMetadata: {
      Item: [
        { Name: 'MpesaReceiptNumber', Value: 'QKN819201A' }
      ]
    }
  }
};

// Extractor function test
function extractMpesaTransactionCodeFromCallback(body) {
  if (!body) return null;
  const items = body?.Body?.stkCallback?.CallbackMetadata?.Item || 
                body?.stkCallback?.CallbackMetadata?.Item || 
                body?.CallbackMetadata?.Item || 
                [];

  if (Array.isArray(items)) {
    for (const item of items) {
      const name = String(item?.Name || '').toLowerCase();
      if (name === 'mpesareceiptnumber' || name === 'receiptnumber' || name === 'transid' || name === 'transactionid') {
        const val = String(item?.Value || '').trim().toUpperCase();
        if (val && val !== 'UNDEFINED' && val !== 'NULL') return val;
      }
    }
  }

  const directCandidates = [
    body?.Body?.stkCallback?.MpesaReceiptNumber,
    body?.stkCallback?.MpesaReceiptNumber,
    body?.MpesaReceiptNumber,
    body?.mpesaReceiptNumber,
    body?.TransID,
    body?.transID,
    body?.TransactionID,
    body?.transactionID
  ];

  for (const candidate of directCandidates) {
    if (candidate) {
      const val = String(candidate).trim().toUpperCase();
      if (val && val !== 'UNDEFINED' && val !== 'NULL') return val;
    }
  }

  function deepSearch(obj) {
    if (!obj || typeof obj !== 'object') return null;
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'mpesareceiptnumber' || lowerKey === 'transid' || lowerKey === 'transactionid' || lowerKey === 'receiptnumber') {
        const val = String(obj[key] || '').trim().toUpperCase();
        if (val && typeof obj[key] !== 'object' && val !== 'UNDEFINED' && val !== 'NULL') return val;
      }
      if (typeof obj[key] === 'object') {
        const nested = deepSearch(obj[key]);
        if (nested) return nested;
      }
    }
    return null;
  }

  return deepSearch(body);
}

// Test 1: STK Callback JSON
console.log('🧪 Test 1: Extract from Standard STK Push Callback JSON...');
const code1 = extractMpesaTransactionCodeFromCallback(stkCallbackJson);
assert.strictEqual(code1, 'TLH7K29X1P');
console.log(`  ✔ Extracted code: ${code1}`);

// Test 2: C2B Callback JSON
console.log('\n🧪 Test 2: Extract from C2B Callback JSON (TransID)...');
const code2 = extractMpesaTransactionCodeFromCallback(c2bCallbackJson);
assert.strictEqual(code2, 'UHUFN4R0HB');
console.log(`  ✔ Extracted code: ${code2}`);

// Test 3: Flattened Callback JSON
console.log('\n🧪 Test 3: Extract from Flattened Callback JSON...');
const code3 = extractMpesaTransactionCodeFromCallback(flattenedCallbackJson);
assert.strictEqual(code3, 'QKN819201A');
console.log(`  ✔ Extracted code: ${code3}`);

console.log('\n================================================================');
console.log('🎉 ALL CALLBACK JSON EXTRACTION TESTS PASSED (100%)!');
console.log('================================================================\n');
