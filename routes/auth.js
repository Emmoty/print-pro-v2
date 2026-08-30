/**
 * CloudPrint Pro - Authentication API Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const auth = require('../lib/auth');

/**
 * POST /api/auth/request-otp
 * Dispatches a cryptographically random 6-digit Magic Passcode to registered staff WhatsApp & Email
 */
router.post('/request-otp', (req, res) => {
  const { identifier } = req.body || {};
  const result = auth.requestOTP(identifier, req);
  if (!result.success) {
    const status = result.lockout ? 429 : 400;
    return res.status(status).json({ error: result.error, lockout: result.lockout, remainingSeconds: result.remainingSeconds });
  }
  return res.json(result);
});

/**
 * POST /api/auth/verify-otp
 * Verifies the 6-digit Magic Passcode, single-use invalidates it, and issues a session token
 */
router.post('/verify-otp', (req, res) => {
  const { identifier, code } = req.body || {};
  const result = auth.verifyOTP(identifier, code, req);
  if (!result.success) {
    const status = result.lockout ? 429 : 401;
    return res.status(status).json({ error: result.error, lockout: result.lockout, remainingSeconds: result.remainingSeconds });
  }
  return res.json(result);
});

/**
 * POST /api/auth/login
 * Traditional staff login with progressive rate limiting and password hash validation
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  // 1. Rate Limit Check (Prevent Brute-Force)
  const rateLimitCheck = auth.checkRateLimit(email.toLowerCase());
  if (!rateLimitCheck.allowed) {
    db.addAuditLog('WARN', `Security: Blocked brute-force attempt on '${email}' from IP ${clientIp}. Locked out for ${rateLimitCheck.remainingSeconds}s.`);
    return res.status(429).json({
      error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${rateLimitCheck.remainingSeconds} seconds.`,
      lockout: true,
      remainingSeconds: rateLimitCheck.remainingSeconds
    });
  }

  // 2. Lookup User
  const user = db.getUserByEmail(email);
  if (!user || user.status !== 'active') {
    auth.recordFailedLogin(email.toLowerCase());
    db.addAuditLog('WARN', `Authentication failed for '${email}' (Invalid credentials or inactive account) from IP ${clientIp}.`);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // 3. Verify Password Hash
  const passwordValid = db.verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    auth.recordFailedLogin(email.toLowerCase());
    db.addAuditLog('WARN', `Authentication failed for '${email}' (Incorrect password) from IP ${clientIp}.`);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // 4. Success - Reset failed attempts & Issue Session
  auth.resetFailedLogins(email.toLowerCase());
  db.updateUser(user.id, { lastLogin: new Date().toISOString() });

  const session = auth.createSession(user, req);
  db.addAuditLog('SUCCESS', `User '${user.name}' (${user.roleLabel}) logged in successfully from IP ${clientIp}.`);

  return res.json({
    message: 'Authentication successful',
    token: session.token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleLabel: user.roleLabel,
      phone: user.phone,
      mfaEnabled: user.mfaEnabled
    }
  });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', auth.requireAuth, (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-admin-token']);
  auth.destroySession(token);
  db.addAuditLog('INFO', `User '${req.user.email}' logged out.`);
  return res.json({ message: 'Logged out successfully.' });
});

/**
 * GET /api/auth/me
 */
router.get('/me', auth.requireAuth, (req, res) => {
  const user = db.getUserById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleLabel: user.roleLabel,
      phone: user.phone,
      mfaEnabled: user.mfaEnabled,
      lastLogin: user.lastLogin
    }
  });
});

module.exports = router;
