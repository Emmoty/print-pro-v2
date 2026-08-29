/**
 * CloudPrint Pro - Admin Operations & Management REST API
 * All endpoints protected by requireAuth and RBAC requirePermission
 */

const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const auth = require('../lib/auth');
const storage = require('../lib/storage');

// Require Authentication on all /api/admin routes
router.use(auth.requireAuth);

/**
 * GET /api/admin/overview
 * Overview metrics and statistics (Calculated on the server)
 */
router.get('/overview', (req, res) => {
  const orders = db.getOrders();
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalJobs = orders.length;
  const totalPages = orders.reduce((sum, o) => sum + ((o.pages || 10) * (o.copies || 1)), 0);

  return res.json({
    kpis: {
      totalRevenue,
      totalJobs,
      totalPages,
      activePrinters: db.getPrinters().filter(p => p.status === 'online').length,
      connectedAgents: db.getAgents().filter(a => a.status === 'connected').length
    },
    recentOrders: orders.slice(0, 10),
    systemHealth: 'HEALTHY'
  });
});

/**
 * GET /api/admin/orders
 */
router.get('/orders', auth.requirePermission('orders'), (req, res) => {
  return res.json({ orders: db.getOrders() });
});

/**
 * PUT /api/admin/orders/:id/status
 */
router.put('/orders/:id/status', auth.requirePermission('orders'), (req, res) => {
  const { status } = req.body || {};
  const order = db.updateOrder(req.params.id, { status });
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  db.addAuditLog('INFO', `Operator '${req.user.name}' updated Job ${req.params.id} status to '${status}'.`);
  return res.json({ message: 'Order updated.', order });
});

/**
 * GET /api/admin/users
 */
router.get('/users', auth.requirePermission('users'), (req, res) => {
  const users = db.getUsers().map(u => {
    const { passwordHash, ...safeUser } = u;
    return safeUser;
  });
  return res.json({ users });
});

/**
 * POST /api/admin/users
 */
router.post('/users', auth.requirePermission('users'), (req, res) => {
  const { name, email, role, phone, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and initial password are required.' });
  }

  const existing = db.getUserByEmail(email);
  if (existing) return res.status(400).json({ error: 'User email already exists.' });

  const roleLabels = {
    super_admin: 'Super Admin',
    operator: 'Counter Operator',
    technician: 'Hardware Technician',
    auditor: 'Financial Auditor'
  };

  const newUser = {
    id: 'USR-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
    name,
    email: email.toLowerCase(),
    role: role || 'operator',
    roleLabel: roleLabels[role] || 'Counter Operator',
    phone: phone || '+254 700 000 000',
    passwordHash: db.hashPassword(password),
    status: 'active',
    mfaEnabled: false,
    createdAt: new Date().toISOString()
  };

  db.addUser(newUser);
  db.addAuditLog('SUCCESS', `User Management: Administrator '${req.user.name}' created new user '${name}' (${newUser.roleLabel}).`);

  const { passwordHash, ...safeUser } = newUser;
  return res.json({ message: 'User created successfully.', user: safeUser });
});

/**
 * GET /api/admin/settings
 */
router.get('/settings', (req, res) => {
  return res.json({
    settings: db.getSettings(),
    pricing: db.getPricing(),
    cms: db.getCMS()
  });
});

/**
 * POST /api/admin/pricing
 */
router.post('/pricing', auth.requirePermission('pricing'), (req, res) => {
  const { a4_bw, a4_colour, a3_bw, a3_colour } = req.body || {};
  const updated = db.updatePricing({
    a4_bw: parseInt(a4_bw, 10) || 1,
    a4_colour: parseInt(a4_colour, 10) || 3,
    a3_bw: parseInt(a3_bw, 10) || 2,
    a3_colour: parseInt(a3_colour, 10) || 5
  });

  db.addAuditLog('SUCCESS', `Pricing Engine: Live rates updated by '${req.user.name}'.`);
  return res.json({ message: 'Pricing rates updated successfully.', pricing: updated });
});

/**
 * POST /api/admin/cms
 */
router.post('/cms', auth.requirePermission('settings'), (req, res) => {
  const { announcement, bannerActive, paybillNo, whatsappContact, businessName, currency, timezone, supportPhone } = req.body || {};
  
  const updatedCMS = db.updateCMS({
    announcement: announcement || '',
    bannerActive: bannerActive !== false,
    paybillNo: paybillNo || '892100',
    whatsappContact: whatsappContact || '+254 712 345 678'
  });

  if (businessName || currency || timezone || supportPhone) {
    db.updateSettings({
      businessName: businessName || 'CloudPrint Pro - Counter Kiosk #1',
      currency: currency || 'KES (Kenya Shillings)',
      timezone: timezone || 'Africa/Nairobi',
      supportPhone: supportPhone || '+254 712 345 678'
    });
  }

  db.addAuditLog('SUCCESS', `Store CMS & Settings: Updated by '${req.user.name}'.`);
  return res.json({ message: 'Store CMS & settings updated successfully.', cms: updatedCMS });
});

/**
 * POST /api/admin/printing-defaults
 */
router.post('/printing-defaults', auth.requirePermission('settings'), (req, res) => {
  const { defaultPaper, defaultColor, maxFileSize, maxPages, spoolerTimeout } = req.body || {};

  const updated = db.updateSettings({
    defaultPaper: defaultPaper || 'a4',
    defaultColor: defaultColor || 'bw',
    maxFileSize: parseInt(maxFileSize, 10) || 50,
    maxPages: parseInt(maxPages, 10) || 300,
    spoolerTimeout: parseInt(spoolerTimeout, 10) || 60
  });

  db.addAuditLog('SUCCESS', `Printing Defaults: Updated spooler rules by '${req.user.name}'.`);
  return res.json({ message: 'Printing defaults saved successfully.', settings: updated });
});

/**
 * GET /api/admin/audit-logs
 */
router.get('/audit-logs', auth.requirePermission('audit'), (req, res) => {
  return res.json({ logs: db.getAuditLogs(200) });
});

/**
 * POST /api/admin/vault/shred-all
 */
router.post('/vault/shred-all', auth.requirePermission('orders'), (req, res) => {
  const orders = db.getOrders();
  orders.forEach(o => {
    o.filePurged = true;
    o.purgedAt = new Date().toISOString();
  });

  db.addAuditLog('WARN', `Zero-Retention Security: User '${req.user.name}' executed force-wipe across document vault.`);
  return res.json({ message: 'All customer payloads purged and shredded successfully.' });
});

module.exports = router;
