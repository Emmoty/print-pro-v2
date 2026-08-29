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
  requireAuth,
  requirePermission,
  ROLE_PERMISSIONS
};
