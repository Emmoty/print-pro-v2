/**
 * ==============================================================================
 * CloudPrint Pro - Real Safaricom Daraja M-Pesa API Gateway
 * ==============================================================================
 * Production & Sandbox Daraja Engine:
 * - OAuth 2.0 Token Generation with automatic token expiry caching
 * - Lipa Na M-Pesa Online (STK Push Express)
 * - STK Transaction Status Query
 * - Phone number normalization (2547XXXXXXXX / 2541XXXXXXXX)
 */

const https = require('https');
const crypto = require('crypto');

// Persistent HTTP Agent with Keep-Alive to eliminate TLS Handshake Latency
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 20,
  timeout: 10000,
  keepAliveMsecs: 60000
});

// In-Memory Token Cache
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Resolves Daraja Base URL based on environment configuration
 */
function getBaseUrl() {
  const env = (process.env.MPESA_ENVIRONMENT || 'sandbox').toLowerCase();
  return env === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

/**
 * Normalizes any Kenyan phone format to Daraja MSISDN standard (254XXXXXXXXX)
 */
function formatPhoneForDaraja(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');

  if (digits.startsWith('254') && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith('0') && (digits.length === 10)) {
    return '254' + digits.substring(1);
  }
  if (digits.startsWith('7') && digits.length === 9) {
    return '254' + digits;
  }
  if (digits.startsWith('1') && digits.length === 9) {
    return '254' + digits;
  }
  if (digits.startsWith('+254')) {
    return digits.substring(1);
  }

  return digits;
}

/**
 * Generates Daraja Timestamp: YYYYMMDDHHMMSS
 */
function getDarajaTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}

/**
 * Generates Base64 Encoded Daraja STK Password
 */
function generatePassword(shortcode, passkey, timestamp) {
  const raw = `${shortcode}${passkey}${timestamp}`;
  return Buffer.from(raw).toString('base64');
}

/**
 * High-Performance HTTPS request helper with persistent TLS socket pooling
 */
function httpsRequest(urlStr, options, postData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqOptions = {
      ...options,
      agent: keepAliveAgent
    };

    const req = https.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const err = new Error(parsed.errorMessage || parsed.ResponseDescription || `Daraja HTTP ${res.statusCode}`);
            err.status = res.statusCode;
            err.body = parsed;
            reject(err);
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ raw: data });
          } else {
            reject(new Error(`Daraja error: ${data}`));
          }
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Safaricom Daraja API request timed out'));
    });

    if (postData) {
      const payload = typeof postData === 'string' ? postData : JSON.stringify(postData);
      req.write(payload);
    }
    req.end();
  });
}

/**
 * Pre-warms and refreshes the OAuth Token in the background
 */
async function warmTokenCache() {
  try {
    await getAccessToken();
  } catch (e) {}
}

/**
 * Retrieves or caches OAuth 2.0 Access Token from Daraja
 */
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('M-Pesa API credentials not configured in environment (MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET).');
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const endpoint = `${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`;

  const res = await httpsRequest(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`
    }
  });

  if (res.access_token) {
    cachedToken = res.access_token;
    const expiresInSec = parseInt(res.expires_in, 10) || 3599;
    tokenExpiresAt = Date.now() + (expiresInSec * 1000);
    return cachedToken;
  }

  throw new Error('Could not obtain M-Pesa Daraja access token from Safaricom.');
}

/**
 * Initiates an M-Pesa STK Push Express prompt
 */
async function initiateSTKPush({ phone, amount, jobId, callbackUrl, accountReference }) {
  const shortcode = process.env.MPESA_BUSINESS_SHORTCODE || '174379';
  const passkey = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
  const formattedPhone = formatPhoneForDaraja(phone);
  const timestamp = getDarajaTimestamp();
  const password = generatePassword(shortcode, passkey, timestamp);

  const resolvedCallbackUrl = callbackUrl || process.env.MPESA_CALLBACK_URL || `${process.env.PUBLIC_APP_URL || 'https://printpro.ke'}/api/payments/webhook`;
  const sanitizedAmount = Math.max(1, Math.round(Number(amount) || 1));

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: sanitizedAmount,
    PartyA: formattedPhone,
    PartyB: shortcode,
    PhoneNumber: formattedPhone,
    CallBackURL: resolvedCallbackUrl,
    AccountReference: (accountReference || jobId || 'PrintJob').substring(0, 12),
    TransactionDesc: `Print Job ${jobId}`.substring(0, 30)
  };

  // Test fallback if keys not configured in local environment
  if (!process.env.MPESA_CONSUMER_KEY || process.env.MPESA_CONSUMER_KEY.includes('YOUR_')) {
    return {
      MerchantRequestID: '29103-99210-' + Date.now(),
      CheckoutRequestID: 'ws_CO_' + timestamp + '_' + Math.floor(1000 + Math.random() * 9000),
      ResponseCode: '0',
      ResponseDescription: 'Success. Request accepted for processing',
      CustomerMessage: 'Success. Request accepted for processing',
      phone: formattedPhone,
      amount: sanitizedAmount
    };
  }

  const token = await getAccessToken();
  const endpoint = `${getBaseUrl()}/mpesa/stkpush/v1/processrequest`;

  const res = await httpsRequest(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, payload);

  return {
    ...res,
    phone: formattedPhone,
    amount: sanitizedAmount
  };
}

const RESULT_CODES = {
  0: { status: 'SUCCESS', message: 'Payment authorized on phone. Awaiting receipt callback.' },
  1032: { status: 'CANCELLED', message: 'Transaction was cancelled by user on phone.' },
  1037: { status: 'TIMEOUT', message: 'Transaction timed out. No response received from phone.' },
  1001: { status: 'FAILED', message: 'Insufficient M-Pesa balance to complete transaction.' },
  1019: { status: 'FAILED', message: 'Transaction has expired on phone.' },
  1025: { status: 'FAILED', message: 'An error occurred while sending push request.' },
  2001: { status: 'FAILED', message: 'Wrong M-Pesa PIN entered on phone.' }
};

function mapResultCodeToStatus(code) {
  const num = Number(code);
  return RESULT_CODES[num] || { 
    status: num === 0 ? 'SUCCESS' : 'FAILED', 
    message: num === 0 ? 'Payment accepted' : 'Transaction failed or rejected' 
  };
}

/**
 * Queries Daraja STK Push transaction status
 */
async function querySTKStatus(checkoutRequestId) {
  const shortcode = process.env.MPESA_BUSINESS_SHORTCODE || '174379';
  const passkey = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
  const timestamp = getDarajaTimestamp();
  const password = generatePassword(shortcode, passkey, timestamp);

  try {
    const token = await getAccessToken();
    const endpoint = `${getBaseUrl()}/mpesa/stkpushquery/v1/query`;

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId
    };

    const res = await httpsRequest(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, payload);

    const resultCode = res.ResultCode !== undefined ? Number(res.ResultCode) : null;
    const mapped = resultCode !== null ? mapResultCodeToStatus(resultCode) : { status: 'PENDING', message: 'Waiting for response' };

    return {
      resultCode: res.ResultCode,
      resultDesc: res.ResultDesc || res.ResponseDescription,
      status: mapped.status,
      userMessage: mapped.message,
      hasReceiptNumber: false,
      raw: res
    };
  } catch (err) {
    if (err.body && (err.body.errorMessage?.includes('being processed') || err.body.errorCode === '500.001.1001')) {
      return { isPending: true, status: 'PENDING', message: 'Transaction still pending on phone' };
    }
    return { isPending: true, status: 'PENDING', error: err.message };
  }
}

module.exports = {
  getAccessToken,
  warmTokenCache,
  initiateSTKPush,
  querySTKStatus,
  formatPhoneForDaraja,
  RESULT_CODES,
  mapResultCodeToStatus
};
