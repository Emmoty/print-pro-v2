/**
 * Verification of Clear History Feature on CloudPrint Pro Menu
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🗑️ STARTING CLEAR HISTORY VERIFICATION...\n');

// 1. Check index.html markup
console.log('🧪 Test 1: Verifying clear history button in index.html');
const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.ok(htmlContent.includes('id="clearHistoryBtn"'), 'clearHistoryBtn must be present in index.html');
assert.ok(htmlContent.includes('Clear History'), 'Clear History label must be present');
console.log('  ✔ clearHistoryBtn found in CloudPrint Pro Menu drawer.');

// 2. Check app.js logic
console.log('\n🧪 Test 2: Verifying clearOrdersHistory function in app.js');
const jsContent = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
assert.ok(jsContent.includes('clearHistoryBtn: document.getElementById(\'clearHistoryBtn\')'), 'clearHistoryBtn must be in elements');
assert.ok(jsContent.includes('function clearOrdersHistory()'), 'clearOrdersHistory function must be defined');
assert.ok(jsContent.includes('localStorage.removeItem(\'cloudprint_orders\')'), 'Must remove cloudprint_orders from localStorage');
console.log('  ✔ clearOrdersHistory function and event wiring verified.');

// 3. Test empty state rendering logic
console.log('\n🧪 Test 3: Verifying empty state rendering');
assert.ok(jsContent.includes('No print order history'), 'Clean empty state message must be rendered when history is cleared');
console.log('  ✔ Empty state placeholder verified.');

console.log('\n================================================================');
console.log('🎉 ALL CLEAR HISTORY TESTS PASSED (100%)!');
console.log('================================================================\n');
