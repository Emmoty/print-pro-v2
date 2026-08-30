/**
 * CloudPrint Pro - Windows Service Configuration & Management Helper
 */

const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

console.log('================================================================');
console.log('🛠️  CLOUDPRINT PRO - WINDOWS SERVICE SETUP');
console.log('================================================================\n');

if (os.platform() !== 'win32') {
  console.log('ℹ️ Non-Windows system detected. Use systemd service template in install_service.sh.');
  process.exit(0);
}

console.log('Windows Service Parameters:');
console.log(`• Service Name : CloudPrintAgent`);
console.log(`• Display Name : CloudPrint Pro Local Print Bridge Service`);
console.log(`• Description  : Secure Print Bridge Daemon connecting Dokploy Server to Local Printers.`);
console.log(`• Startup Type : Automatic (Starts on boot without user login)\n`);

console.log('To install and run 24/7 as a background Windows Service:');
console.log('1. Run `agent\\install_service.bat` as Administrator.');
console.log('2. Or execute via PowerShell:');
console.log('   New-Service -Name "CloudPrintAgent" -BinaryPathName "node.exe ' + path.join(__dirname, 'index.js') + '" -StartupType Automatic\n');
