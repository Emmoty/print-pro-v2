/**
 * Magic Passcode / OTP Authentication Engine Test Suite
 */

const assert = require('assert');
const auth = require('../lib/auth');
const db = require('../lib/db');

console.log('🔐 STARTING MAGIC PASSCODE / OTP AUTHENTICATION TEST SUITE...\n');

// 1. Request OTP for Super Admin
console.log('🧪 Test 1: Request OTP for Super Admin (admin)');
const reqResult = auth.requestOTP('admin', { headers: { 'x-forwarded-for': '127.0.0.1' }, socket: { remoteAddress: '127.0.0.1' } });
assert(reqResult.success, 'OTP request must succeed for valid staff identifier');
assert(reqResult.devCode && reqResult.devCode.length === 6, 'Dev code must be a 6-digit numeric string');
assert(reqResult.maskedDestination.includes('***'), 'Destination must be securely masked');
console.log(`  ✔ OTP generated: ${reqResult.devCode}, destination: ${reqResult.maskedDestination}`);

// 2. Request OTP for invalid staff identifier
console.log('\n🧪 Test 2: Request OTP for invalid staff identifier');
const invalidReq = auth.requestOTP('invalid_user_xyz', {});
assert(!invalidReq.success, 'Must reject unknown staff accounts');
console.log(`  ✔ Rejected unknown staff user: "${invalidReq.error}"`);

// 3. Verify OTP with incorrect code
console.log('\n🧪 Test 3: Verify OTP with incorrect code');
const wrongVerify = auth.verifyOTP('admin', '000000', {});
assert(!wrongVerify.success, 'Must fail for incorrect passcode');
assert(wrongVerify.error.includes('Incorrect passcode'), 'Must return helpful attempt count');
console.log(`  ✔ Correctly rejected incorrect code: "${wrongVerify.error}"`);

// 4. Verify OTP with correct code
console.log('\n🧪 Test 4: Verify OTP with correct code');
const correctVerify = auth.verifyOTP('admin', reqResult.devCode, { headers: { 'x-forwarded-for': '127.0.0.1' } });
assert(correctVerify.success, 'Verification must succeed for correct passcode');
assert(correctVerify.token && correctVerify.token.startsWith('cptk_sess_') || correctVerify.token.length > 20, 'Must issue a secure session token');
assert.strictEqual(correctVerify.user.role, 'super_admin', 'Must return authenticated Super Admin user profile');
console.log(`  ✔ Authentication successful! Issued session token: ${correctVerify.token.slice(0, 16)}...`);

// 5. Test Single-Use Token Protection (Replaying same code must fail)
console.log('\n🧪 Test 5: Single-Use Protection (Replay Prevention)');
const replayVerify = auth.verifyOTP('admin', reqResult.devCode, {});
assert(!replayVerify.success, 'Used code must be invalidated immediately');
console.log(`  ✔ Replay prevented: "${replayVerify.error}"`);

console.log('\n================================================================');
console.log('🎉 ALL MAGIC PASSCODE AUTHENTICATION TESTS PASSED (100%)!');
console.log('================================================================\n');
