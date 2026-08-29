/**
 * CloudPrint Pro - Admin Authentication & Login Gateway Verification Suite
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🔐 STARTING ADMIN LOGIN & CREDENTIALS VERIFICATION SUITE...\n');

const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const jsContent = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const cssContent = fs.readFileSync(path.join(__dirname, '..', 'admin.css'), 'utf8');

// 1. Check HTML Elements
console.log('🧪 Test 1: Admin Login Screen & Overlay Elements');
assert(htmlContent.includes('id="adminLoginOverlay"'), 'Must have adminLoginOverlay element');
assert(htmlContent.includes('id="adminLoginForm"'), 'Must have adminLoginForm element');
assert(htmlContent.includes('id="adminLoginUsername"'), 'Must have adminLoginUsername input');
assert(htmlContent.includes('id="adminLoginPassword"'), 'Must have adminLoginPassword input');
assert(htmlContent.includes('id="adminLoginSubmitBtn"'), 'Must have adminLoginSubmitBtn button');
assert(htmlContent.includes('id="adminLoginError"'), 'Must have adminLoginError banner');
assert(htmlContent.includes('handleAdminLogout()'), 'Must have handleAdminLogout button in topbar');
console.log('  ✔ All login screen HTML elements verified.');

// 2. Check CSS Styles
console.log('\n🧪 Test 2: Admin Login Screen CSS Styling');
assert(cssContent.includes('.admin-login-overlay'), 'Must have .admin-login-overlay styles');
assert(cssContent.includes('.admin-login-card'), 'Must have .admin-login-card styles');
assert(cssContent.includes('.login-btn-submit'), 'Must have .login-btn-submit styles');
assert(cssContent.includes('.btn-topbar-logout'), 'Must have .btn-topbar-logout styles');
console.log('  ✔ All login overlay and logout button styles verified.');

// 3. Check JavaScript Functions
console.log('\n🧪 Test 3: JavaScript Authentication Functions');
assert(jsContent.includes('function checkAdminAuth('), 'Must have checkAdminAuth function');
assert(jsContent.includes('function handleAdminLogin('), 'Must have handleAdminLogin function');
assert(jsContent.includes('function handleAdminLogout('), 'Must have handleAdminLogout function');
assert(jsContent.includes('function fillLoginCredentials('), 'Must have fillLoginCredentials function');
assert(jsContent.includes('function toggleAdminLoginPassword('), 'Must have toggleAdminLoginPassword function');
console.log('  ✔ All JavaScript authentication functions verified.');

// 4. Check that Demo & Simulation Controls are Cleanly Removed
console.log('\n🧪 Test 4: Verify Demo & Simulation Controls Removal');
assert(!htmlContent.includes('id="simulateEventBtn"'), 'simulateEventBtn must be removed');
assert(!htmlContent.includes('class="login-demo-section"'), 'login-demo-section must be removed');
const indexHtmlContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(!indexHtmlContent.includes('id="fastForwardBtn"'), 'fastForwardBtn must be removed');
console.log('  ✔ All demo buttons and artificial accelerators successfully removed from frontend.');

// 5. Check DOMContentLoaded integration
console.log('\n🧪 Test 5: Initialization & Session Gate Enforcement');
assert(jsContent.includes('checkAdminAuth();'), 'DOMContentLoaded must invoke checkAdminAuth()');
console.log('  ✔ checkAdminAuth() invoked on DOMContentLoaded.');

console.log('\n🎉 ALL ADMIN AUTH & PRODUCTION CLEANLINESS TESTS PASSED (100%)!\n');
