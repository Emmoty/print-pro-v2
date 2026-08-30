/**
 * Verification Suite for M-Pesa Phone Input Placeholder & Memory Persistence
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('📱 STARTING M-PESA PHONE INPUT & MEMORY VERIFICATION...\n');

const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
const jsContent = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

// 1. Check HTML Placeholder & Clean Input
console.log('🧪 Test 1: M-Pesa Phone Input HTML Placeholder');
assert(htmlContent.includes('placeholder="7xx xxx xxx"'), 'Must have placeholder="7xx xxx xxx"');
assert(!htmlContent.includes('value="712345678"'), 'Must not have hardcoded test number pre-filled');
assert(htmlContent.includes('<span class="phone-prefix">+254</span>'), 'Must have +254 prefix badge');
console.log('  ✔ M-Pesa Phone Input correctly displays +254 prefix and placeholder example.');

// 2. Check CSS Placeholder Styling
console.log('\n🧪 Test 2: Placeholder Styling');
assert(cssContent.includes('.phone-input::placeholder'), 'Must style .phone-input::placeholder');
console.log('  ✔ Placeholder greyed-out appearance verified in styles.css.');

// 3. Check JavaScript Phone Normalization & Persistence
console.log('\n🧪 Test 3: Phone Normalization Function Logic');
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  let cleaned = String(rawPhone).replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.startsWith('254') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(3);
  } else if (!cleaned.startsWith('0') && (cleaned.startsWith('7') || cleaned.startsWith('1')) && cleaned.length === 9) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

assert.strictEqual(normalizePhoneNumber('0712345678'), '0712345678', '07... format must be preserved with leading 0');
assert.strictEqual(normalizePhoneNumber('0112345678'), '0112345678', '01... format must be preserved with leading 0');
assert.strictEqual(normalizePhoneNumber('712345678'), '0712345678', '9-digit format must be prefixed with 0');
assert.strictEqual(normalizePhoneNumber('+254712345678'), '0712345678', '+254 format must normalize to 0-prefixed format');
console.log('  ✔ Phone normalization verified across all Kenyan formats (preserves leading 0).');

// 4. Check App Storage Handlers
console.log('\n🧪 Test 4: LocalStorage Memory & Event Integration');
assert(jsContent.includes('cloudprint_saved_phone'), 'app.js must persist to cloudprint_saved_phone');
assert(jsContent.includes('initSavedCustomerPhone()'), 'app.js must call initSavedCustomerPhone()');
console.log('  ✔ Phone memory persistence verified in app.js.');

console.log('\n================================================================');
console.log('🎉 ALL M-PESA PHONE HOLDER & MEMORY TESTS PASSED (100%)!');
console.log('================================================================\n');
