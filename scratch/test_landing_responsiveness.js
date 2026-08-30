/**
 * Verification Suite for Landing Page & Multi-Device Responsiveness
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('📱 STARTING LANDING PAGE & RESPONSIVENESS VERIFICATION...\n');

const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
const jsContent = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

// 1. Landing Page Structure & Clean Kiosk Header
console.log('🧪 Test 1: Landing Page Hero & Clean Kiosk Header');
assert(!htmlContent.includes('class="showcase-header"'), 'Showcase header must be removed');
assert(!htmlContent.includes('class="trust-pillars-grid"'), 'Trust pillars grid must be removed');
assert(!htmlContent.includes('Live CMS Synced'), 'Live CMS Synced tag must be removed');
assert(!htmlContent.includes('Express Kiosk Active • Instant M-Pesa'), 'Express Kiosk badge must be removed');
assert(htmlContent.includes('id="screenHome"'), 'Must have screenHome landing page');
console.log('  ✔ Clean, minimal landing page verified.');

// 2. Responsive CSS Media Queries & Fluid Clamp Typography
console.log('\n🧪 Test 2: Multi-Device CSS Media Queries & Fluid Engine');
assert(cssContent.includes('@media (max-width: 600px)'), 'Must have mobile media query <= 600px');
assert(cssContent.includes('@media (max-width: 360px)'), 'Must have small mobile query <= 360px');
assert(cssContent.includes('clamp('), 'Must use clamp() for fluid typography');
assert(cssContent.includes('.trust-pillars-grid'), 'Must style .trust-pillars-grid');
assert(cssContent.includes('.live-dot-green'), 'Must style .live-dot-green');
assert(cssContent.includes('overflow-x: hidden'), 'Must prevent horizontal overflow');
console.log('  ✔ Multi-device responsive engine and fluid typography verified.');

// 3. JavaScript Adaptive Viewport Logic
console.log('\n🧪 Test 3: JavaScript Adaptive Viewport Detection');
assert(jsContent.includes('window.innerWidth >= 768'), 'Must auto-detect widescreen displays');
assert(jsContent.includes('cloudprint_view_mode'), 'Must persist manual view mode preference');
assert(jsContent.includes("setViewMode('fluid'"), 'Must support fluid expanded mode');
console.log('  ✔ Adaptive viewport detection and mode persistence verified.');

console.log('\n================================================================');
console.log('🎉 ALL LANDING PAGE & RESPONSIVENESS TESTS PASSED (100%)!');
console.log('================================================================\n');
