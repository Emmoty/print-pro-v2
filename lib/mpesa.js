/**
 * ==============================================================================
 * CloudPrint Pro - Safaricom Daraja M-Pesa Module Bridge
 * ==============================================================================
 * Exposes the modular M-Pesa Gateway, Payment Engine, and SSE Manager.
 */

const darajaGateway = require('./mpesa/darajaGateway');
const paymentEngine = require('./mpesa/paymentEngine');
const sseManager = require('./mpesa/sseManager');

module.exports = {
  // Low-level Gateway
  getBaseUrl: darajaGateway.getBaseUrl,
  formatPhoneForDaraja: darajaGateway.formatPhoneForDaraja,
  getAccessToken: darajaGateway.getAccessToken,
  warmTokenCache: darajaGateway.warmTokenCache,
  initiateSTKPush: darajaGateway.initiateSTKPush,
  querySTKStatus: darajaGateway.querySTKStatus,
  RESULT_CODES: darajaGateway.RESULT_CODES,
  mapResultCodeToStatus: darajaGateway.mapResultCodeToStatus,

  // High-Level Payment Engine
  paymentEngine,
  sseManager
};
