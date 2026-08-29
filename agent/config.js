/**
 * CloudPrint Pro - Print Agent Configuration Loader
 */

require('dotenv').config();
const path = require('path');
const os = require('os');

module.exports = {
  // Remote Server Connection
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:3000',
  AGENT_ID: process.env.AGENT_ID || 'AGT-LAN-01',
  AGENT_TOKEN: process.env.AGENT_TOKEN || 'cloudprint_agent_secret_key_01',

  // Polling & Heartbeat Intervals
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || '3000', 10),
  HEARTBEAT_INTERVAL_MS: parseInt(process.env.HEARTBEAT_INTERVAL_MS || '15000', 10),

  // Network & System Info
  HOSTNAME: os.hostname(),
  PLATFORM: os.platform(),
  TEMP_DIR: process.env.AGENT_TEMP_DIR || path.join(__dirname, 'temp_spool'),

  // Printer Routing Configuration
  PRINTER_ROUTES: {
    a4_bw: process.env.PRINTER_A4_BW || 'Default',
    a4_colour: process.env.PRINTER_A4_COLOUR || 'Default',
    a3_bw: process.env.PRINTER_A3_BW || 'Default',
    a3_colour: process.env.PRINTER_A3_COLOUR || 'Default',
    default: process.env.DEFAULT_PRINTER || 'Default'
  },

  // Raw Socket Printers (Optional direct IP:9100 printers)
  RAW_PRINTERS: {
    // 'PRN-01': { host: '192.168.1.104', port: 9100 }
  }
};
