/**
 * Comprehensive Verification of Admin Login & Wrong Credential Notifications
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🛡️ STARTING ADMIN LOGIN & NOTIFICATION SUITE...\n');

const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(__dirname, '..', 'admin.css'), 'utf8');
const jsContent = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');

// 1. Check HTML Elements for Login and Notifications
console.log('🧪 Test 1: HTML Login & Toast Container Elements');
assert(htmlContent.includes('id="adminLoginOverlay"'), 'Must have adminLoginOverlay');
assert(htmlContent.includes('id="adminLoginError"'), 'Must have adminLoginError banner');
assert(htmlContent.includes('id="adminLoginErrorText"'), 'Must have adminLoginErrorText span');
assert(htmlContent.includes('id="adminToastContainer"'), 'Must have adminToastContainer');
assert(htmlContent.includes('id="adminLoginSubmitBtn"'), 'Must have adminLoginSubmitBtn');
console.log('  ✔ HTML overlay, banner, and toast container verified.');

// 2. Check CSS Error and Shake Styles
console.log('\n🧪 Test 2: CSS Shake Animation & Error Toast Styling');
assert(cssContent.includes('.login-error-banner'), 'Must style .login-error-banner');
assert(cssContent.includes('@keyframes cardShake'), 'Must define @keyframes cardShake');
assert(cssContent.includes('.admin-login-card.shake'), 'Must style .admin-login-card.shake');
assert(cssContent.includes('.toast.error'), 'Must style .toast.error');
assert(cssContent.includes('.toast-container'), 'Must style .toast-container');
console.log('  ✔ CSS card shake, error banner, and error toast styling verified.');

// 3. Check JavaScript Error Handler Logic
console.log('\n🧪 Test 3: JavaScript Login & Error Notification Logic');
assert(jsContent.includes('showAdminToast'), 'Must define showAdminToast()');
assert(jsContent.includes('toggleAdminLoginPassword'), 'Must define toggleAdminLoginPassword()');
assert(jsContent.includes("triggerError('Invalid username or password"), 'Must trigger error banner and notification on invalid credentials');
assert(jsContent.includes("loginCard.classList.add('shake')"), 'Must trigger card shake animation on wrong credentials');
console.log('  ✔ JavaScript error banner, card shake, and error toast dispatch verified.');

console.log('\n================================================================');
console.log('🎉 ALL ADMIN LOGIN & NOTIFICATION TESTS PASSED (100%)!');
console.log('================================================================\n');
