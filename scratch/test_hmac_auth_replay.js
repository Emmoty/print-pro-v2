/**
 * HMAC-SHA256 Authentication & Anti-Replay Defense Verification Suite
 */

const assert = require('assert');
const auth = require('../agent/auth');

console.log('🛡️  STARTING HMAC-SHA256 AUTHENTICATION & REPLAY TEST SUITE...\n');

const agentId = 'AGT-TEST-01';
const secret = 'test_secret_key_8849201948271039';

// 1. Test Valid HMAC Signature Generation & Verification
console.log('🧪 Test 1: Cryptographic HMAC Signature Generation & Verification');
const headers = auth.generateAuthHeaders('POST', '/api/print/heartbeat', { test: true }, agentId, secret);

const mockReq = {
  method: 'POST',
  originalUrl: '/api/print/heartbeat',
  headers: headers,
  body: { test: true }
};

const result = auth.verifyAuthHeaders(mockReq, (id) => id === agentId ? secret : null);
assert.strictEqual(result.isValid, true, 'Valid signature must be verified successfully');
assert.strictEqual(result.agentId, agentId);
console.log('  ✔ Valid HMAC-SHA256 signature verified.');

// 2. Test Tampered Body Attack Rejection
console.log('\n🧪 Test 2: Tampered Body Attack Defense');
const tamperedReq = {
  method: 'POST',
  originalUrl: '/api/print/heartbeat',
  headers: headers,
  body: { test: true, maliciousPayload: true } // Body modified in transit
};

const tamperedResult = auth.verifyAuthHeaders(tamperedReq, (id) => id === agentId ? secret : null);
assert.strictEqual(tamperedResult.isValid, false, 'Tampered body must fail verification');
assert.strictEqual(tamperedResult.reason, 'INVALID_SIGNATURE');
console.log('  ✔ Tampered request correctly rejected with INVALID_SIGNATURE.');

// 3. Test Expired Timestamp (Clock Skew) Attack Rejection
console.log('\n🧪 Test 3: Expired Timestamp Attack Defense');
const expiredHeaders = {
  ...headers,
  'x-agent-timestamp': (Math.floor(Date.now() / 1000) - 400).toString() // 400s in past (> 300s limit)
};

const expiredReq = {
  method: 'POST',
  originalUrl: '/api/print/heartbeat',
  headers: expiredHeaders,
  body: { test: true }
};

const expiredResult = auth.verifyAuthHeaders(expiredReq, (id) => id === agentId ? secret : null);
assert.strictEqual(expiredResult.isValid, false, 'Expired timestamp must fail verification');
assert.strictEqual(expiredResult.reason, 'TIMESTAMP_EXPIRED');
console.log('  ✔ Stale timestamp correctly rejected with TIMESTAMP_EXPIRED.');

// 4. Test Invalid Secret / Unknown Agent Rejection
console.log('\n🧪 Test 4: Unknown Agent / Invalid Secret Defense');
const rogueResult = auth.verifyAuthHeaders(mockReq, () => 'different_secret_key');
assert.strictEqual(rogueResult.isValid, false);
assert.strictEqual(rogueResult.reason, 'INVALID_SIGNATURE');
console.log('  ✔ Unauthorized secret correctly rejected with INVALID_SIGNATURE.');

console.log('\n================================================================');
console.log('🎉 ALL HMAC & ANTI-REPLAY TESTS PASSED (100%)!');
console.log('================================================================\n');
