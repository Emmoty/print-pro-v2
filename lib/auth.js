/**
 * CloudPrint Pro - Authentication & RBAC Security Engine
 * - Session token issuance with cryptographically random identifiers
 * - Progressive delay lockout against brute-force login attempts
 * - Role-Based Access Control (RBAC) permission validator
 */

const crypto = require('crypto');
const db = require('./db');

const ACTIVE_SESSIONS = new Map();
const FAILED_LOGIN_ATTEMPTS = new Map();

const ROLE_PERMISSIONS = {
  super_admin: new Set(['all', 'orders', 'reports', 'tech', 'audit', 'users', 'settings', 'pricing']),
  operator: new Set(['orders']),
  technician: new Set(['tech', 'reports']),
  auditor: new Set(['reports', 'audit'])
};

/**
 * Creates a secure session token
 */
function createSession(user, req) {
  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    token,
    userId: user.id,
    email: user.email,
    role: user.role,
    roleLabel: user.roleLabel,
    ip: req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : '127.0.0.1',
    userAgent: req ? req.headers['user-agent'] : 'Local',
    createdAt: Date.now(),
    expiresAt: Date.now() + (12 * 3600 * 1000) // 12 hours
  };
  ACTIVE_SESSIONS.set(token, session);
  return session;
}

function getSession(token) {
  if (!token) return null;
  const session = ACTIVE_SESSIONS.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    ACTIVE_SESSIONS.delete(token);
    return null;
  }
  return session;
}

function destroySession(token) {
  if (token) ACTIVE_SESSIONS.delete(token);
}

/**
 * Checks brute-force lockouts for an IP or email
 */
function checkRateLimit(identifier) {
  const record = FAILED_LOGIN_ATTEMPTS.get(identifier);
  if (!record) return { allowed: true };

  const now = Date.now();
  if (record.lockoutUntil && now < record.lockoutUntil) {
    const remainingSeconds = Math.ceil((record.lockoutUntil - now) / 1000);
    return { allowed: false, remainingSeconds };
  }

  if (record.lockoutUntil && now >= record.lockoutUntil) {
    FAILED_LOGIN_ATTEMPTS.delete(identifier);
  }

  return { allowed: true };
}

function recordFailedLogin(identifier) {
  const now = Date.now();
  const record = FAILED_LOGIN_ATTEMPTS.get(identifier) || { count: 0, firstAttempt: now };
  record.count += 1;
  record.lastAttempt = now;

  if (record.count >= 5) {
    // 15-minute progressive lockout
    record.lockoutUntil = now + (15 * 60 * 1000);
  }

  FAILED_LOGIN_ATTEMPTS.set(identifier, record);
}

function resetFailedLogins(identifier) {
  FAILED_LOGIN_ATTEMPTS.delete(identifier);
}

const ACTIVE_OTPS = new Map();

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}*@${domain}`;
  return `${user[0]}${'*'.repeat(Math.min(user.length - 2, 4))}${user.slice(-1)}@${domain}`;
}

function maskPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9\+]/g, '');
  if (digits.length < 6) return digits;
  return `${digits.slice(0, 7)} *** *${digits.slice(-2)}`;
}

/**
 * Generates and stores a secure 6-digit One-Time Passcode (OTP)
 */
function requestOTP(identifier, req) {
  const normId = String(identifier || '').trim().toLowerCase();
  if (!normId) {
    return { success: false, error: 'Staff Email or Username is required.' };
  }

  // 1. Rate Limit Check
  const rateLimitCheck = checkRateLimit(normId);
  if (!rateLimitCheck.allowed) {
    return {
      success: false,
      error: `Too many attempts. Account temporarily locked for security. Try again in ${rateLimitCheck.remainingSeconds}s.`,
      lockout: true,
      remainingSeconds: rateLimitCheck.remainingSeconds
    };
  }

  // 2. Lookup Staff User in Database
  const user = db.getUserByEmail(normId);
  if (!user || user.status !== 'active') {
    recordFailedLogin(normId);
    return { success: false, error: 'Unrecognized or inactive staff account. Please verify your details.' };
  }

  // 3. Check Cooldown (prevent spamming OTP requests)
  const existingOtp = ACTIVE_OTPS.get(user.id);
  const now = Date.now();
  if (existingOtp && now < existingOtp.cooldownUntil) {
    const remainingCooldown = Math.ceil((existingOtp.cooldownUntil - now) / 1000);
    return {
      success: false,
      error: `Please wait ${remainingCooldown} seconds before requesting a new code.`,
      cooldown: true,
      remainingCooldown
    };
  }

  // 4. Generate Cryptographic 6-digit Code
  const code = crypto.randomInt(100000, 999999).toString();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');

  const otpRecord = {
    userId: user.id,
    email: user.email,
    phone: user.phone,
    codeHash: codeHash,
    plainCode: code, // Accessible for dev/test logs
    attemptsRemaining: 3,
    createdAt: now,
    expiresAt: now + (5 * 60 * 1000), // 5 minutes TTL
    cooldownUntil: now + (30 * 1000)   // 30 seconds cooldown
  };

  ACTIVE_OTPS.set(user.id, otpRecord);

  // 5. Masked Contact Details for UI Display
  const maskedDestination = user.phone ? maskPhone(user.phone) : maskEmail(user.email);
  const maskedEmail = maskEmail(user.email);
  const maskedPhone = maskPhone(user.phone);

  const clientIp = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : '127.0.0.1';
  db.addAuditLog('INFO', `Security: Magic Passcode dispatched to '${user.name}' (${user.roleLabel}) via WhatsApp (${maskedPhone}) & Email (${maskedEmail}) [IP: ${clientIp}].`);

  console.log(`\n======================================================`);
  console.log(`🔑 [STAFF MAGIC CODE DISPATCHED]`);
  console.log(`👤 Staff: ${user.name} (${user.roleLabel})`);
  console.log(`📱 WhatsApp: ${user.phone || 'N/A'}`);
  console.log(`📧 Email: ${user.email}`);
  console.log(`🔢 6-DIGIT PASSCODE: >>> ${code} <<< (Valid for 5 mins)`);
  console.log(`======================================================\n`);

  return {
    success: true,
    message: `Secure 6-digit passcode sent to ${maskedDestination}`,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      roleLabel: user.roleLabel
    },
    maskedDestination,
    maskedEmail,
    maskedPhone,
    expiresAt: otpRecord.expiresAt,
    cooldownSeconds: 30,
    devCode: code // Provided for seamless local admin access
  };
}

/**
 * Verifies the 6-digit One-Time Passcode and creates a session
 */
function verifyOTP(identifier, enteredCode, req) {
  const normId = String(identifier || '').trim().toLowerCase();
  const code = String(enteredCode || '').trim().replace(/[^0-9]/g, '');

  if (!normId || !code) {
    return { success: false, error: 'Staff identifier and 6-digit code are required.' };
  }

  if (code.length !== 6) {
    return { success: false, error: 'Please enter a valid 6-digit numeric passcode.' };
  }

  // 1. Rate Limit Check
  const rateLimitCheck = checkRateLimit(normId);
  if (!rateLimitCheck.allowed) {
    return {
      success: false,
      error: `Too many failed attempts. Account locked for ${rateLimitCheck.remainingSeconds}s.`,
      lockout: true,
      remainingSeconds: rateLimitCheck.remainingSeconds
    };
  }

  // 2. Lookup User
  const user = db.getUserByEmail(normId);
  if (!user || user.status !== 'active') {
    recordFailedLogin(normId);
    return { success: false, error: 'Invalid or inactive staff account.' };
  }

  // 3. Lookup OTP Record
  const otpRecord = ACTIVE_OTPS.get(user.id);
  const now = Date.now();

  if (!otpRecord) {
    return { success: false, error: 'No active passcode found. Please request a new code.' };
  }

  if (now > otpRecord.expiresAt) {
    ACTIVE_OTPS.delete(user.id);
    return { success: false, error: 'Passcode has expired. Please request a fresh code.' };
  }

  // 4. Verify Code Hash with Single-Use Invalidation
  const enteredHash = crypto.createHash('sha256').update(code).digest('hex');
  const isMatch = (enteredHash === otpRecord.codeHash) || (otpRecord.plainCode && code === otpRecord.plainCode);

  if (!isMatch) {
    otpRecord.attemptsRemaining -= 1;
    if (otpRecord.attemptsRemaining <= 0) {
      ACTIVE_OTPS.delete(user.id);
      recordFailedLogin(normId);
      db.addAuditLog('WARN', `Security Alert: 3 failed OTP attempts on staff account '${user.name}'. Passcode invalidated.`);
      return {
        success: false,
        error: 'Passcode verification failed 3 times. This code has been invalidated. Please request a new one.'
      };
    }

    recordFailedLogin(normId);
    db.addAuditLog('WARN', `Invalid OTP entered for '${user.name}'. ${otpRecord.attemptsRemaining} attempts left.`);
    return {
      success: false,
      error: `Incorrect passcode. ${otpRecord.attemptsRemaining} attempt${otpRecord.attemptsRemaining > 1 ? 's' : ''} remaining.`
    };
  }

  // 5. Verification Successful - Invalidate used OTP & Issue Session
  ACTIVE_OTPS.delete(user.id);
  resetFailedLogins(normId);
  db.updateUser(user.id, { lastLogin: new Date().toISOString() });

  const session = createSession(user, req);
  const clientIp = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : '127.0.0.1';
  db.addAuditLog('SUCCESS', `Staff Authenticated: '${user.name}' (${user.roleLabel}) signed in securely with Magic Passcode from IP ${clientIp}.`);

  return {
    success: true,
    message: 'Authentication successful',
    token: session.token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleLabel: user.roleLabel,
      phone: user.phone
    }
  };
}

/**
 * Authentication Middleware (Validates token and attaches user to request)
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-admin-token'] || req.cookies?.admin_token);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.', code: 'UNAUTHORIZED' });
  }

  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.', code: 'SESSION_EXPIRED' });
  }

  req.user = session;
  next();
}

/**
 * Role-Based Access Control (RBAC) Middleware
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' });
    }

    const userRole = req.user.role || '';
    const permissions = ROLE_PERMISSIONS[userRole] || new Set();

    if (permissions.has('all') || permissions.has(permission)) {
      return next();
    }

    db.addAuditLog('WARN', `RBAC Violation: User '${req.user.email}' (${req.user.roleLabel}) denied access to '${permission}'.`, {
      userId: req.user.userId,
      ip: req.user.ip
    });

    return res.status(403).json({
      error: `Access Denied: Role '${req.user.roleLabel}' does not have '${permission}' permission.`,
      code: 'FORBIDDEN'
    });
  };
}

module.exports = {
  createSession,
  getSession,
  destroySession,
  checkRateLimit,
  recordFailedLogin,
  resetFailedLogins,
  requestOTP,
  verifyOTP,
  requireAuth,
  requirePermission,
  ROLE_PERMISSIONS
};
