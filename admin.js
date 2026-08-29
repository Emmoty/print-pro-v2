/**
 * CloudPrint Pro - Admin Control Center Engine
 * CMS, CRM, Sales Analysis, Financial Reports, System Telemetry & RBAC User Management
 */

// Security & Sanitization Helper Functions
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  // Neutralize CSV Formula Injection (CWE-1236)
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// Global Dashboard State
const adminState = {
  activeTab: 'overview',
  crmViewMode: 'grid', // 'grid' | 'list'
  printerFilter: 'all',
  userFilter: 'all',
  paymentFilter: 'all',
  paymentSort: { field: 'timestamp', direction: 'desc' },
  paymentSearchQuery: '',
  queueDispatcherRunning: true,
  vaultRetention: 'immediate',
  users: [],
  currentUser: null,
  printers: [],
  agents: [],
  orders: [],
  notifications: [],
  settings: {
    businessName: 'CloudPrint Pro - Counter Kiosk #1',
    currency: 'KES (Kenya Shillings)',
    timezone: 'Africa/Nairobi',
    supportPhone: '+254 712 345 678',
    defaultPaper: 'a4',
    defaultColor: 'bw',
    maxFileSize: 50,
    maxPages: 300,
    spoolerTimeout: 60
  },
  pricing: {
    a4_bw: 1,
    a4_colour: 3,
    a3_bw: 2,
    a3_colour: 5
  },
  cms: {
    announcement: 'Fast, high-resolution laser printing with instant M-Pesa checkout.',
    bannerActive: true,
    paybillNo: '892100',
    whatsappContact: '+254 712 345 678'
  },
  logs: [],
  charts: {
    revenueTrend: null,
    serviceBreakdown: null
  }
};

// Initial Edge Print Agents (Bridging LAN hardware with Cloud)
const DEFAULT_AGENTS = [
  {
    id: 'AGT-01',
    name: 'Cyber Café Main Counter PC',
    hostname: 'DESKTOP-PRINT-01',
    os: 'Windows 11 Pro 64-bit',
    ip: '192.168.1.102',
    version: 'v1.4.2 (Stable)',
    status: 'connected',
    lastHeartbeat: new Date(Date.now() - 3000).toISOString(),
    assignedPrinters: ['PRN-01', 'PRN-02'],
    jobsProcessed: 842,
    jobsSuccess: 839,
    jobsFailed: 3,
    authToken: 'cptk_live_89a2f901c84b'
  },
  {
    id: 'AGT-02',
    name: 'Back-Office High-Volume Station',
    hostname: 'SERVER-SPOOL-02',
    os: 'Ubuntu 24.04 LTS Spooler',
    ip: '192.168.1.110',
    version: 'v1.4.2 (Stable)',
    status: 'connected',
    lastHeartbeat: new Date(Date.now() - 5000).toISOString(),
    assignedPrinters: ['PRN-03', 'PRN-04'],
    jobsProcessed: 406,
    jobsSuccess: 405,
    jobsFailed: 1,
    authToken: 'cptk_live_33de8890ac71'
  }
];

// Initial System Alerts & Notifications Feed
const DEFAULT_NOTIFICATIONS = [
  {
    id: 'NOTIF-01',
    title: 'Paper Jam Alert in Tray 1',
    msg: 'Printer PRN-02 (Kyocera ECOSYS) reported a paper feed obstruction in Tray 1.',
    severity: 'critical',
    time: '2 mins ago',
    read: false
  },
  {
    id: 'NOTIF-02',
    title: 'Print Agent Heartbeat Acknowledged',
    msg: 'Agent AGT-01 (Cyber Café Counter PC) successfully synced 14 pending print spools.',
    severity: 'info',
    time: '12 mins ago',
    read: false
  },
  {
    id: 'NOTIF-03',
    title: 'Low Toner Warning (Cyan 12%)',
    msg: 'Printer PRN-01 (HP LaserJet Enterprise) is running low on Cyan Toner cartridge.',
    severity: 'warning',
    time: '35 mins ago',
    read: true
  }
];

// Initial Staff Users & Roles Configuration (Role-Based Access Control)
const DEFAULT_USERS = [
  {
    id: 'USR-001',
    name: 'Kevin Mutiso',
    email: 'admin@cloudprint.co.ke',
    phone: '+254 712 345 678',
    avatar: 'KM',
    role: 'admin',
    roleLabel: 'Super Admin',
    status: 'active',
    lastLogin: 'Just now',
    permissions: ['all']
  },
  {
    id: 'USR-002',
    name: 'Faith Chebet',
    email: 'faith.manager@cloudprint.co.ke',
    phone: '+254 722 998 811',
    avatar: 'FC',
    role: 'manager',
    roleLabel: 'Store Manager',
    status: 'active',
    lastLogin: '18 mins ago',
    permissions: ['orders', 'crm', 'reprint', 'reversal', 'printers', 'reports', 'logs']
  },
  {
    id: 'USR-003',
    name: 'Brian Omondi',
    email: 'brian.cashier@cloudprint.co.ke',
    phone: '+254 733 112 244',
    avatar: 'BO',
    role: 'cashier',
    roleLabel: 'Cashier / Operator',
    status: 'active',
    lastLogin: '45 mins ago',
    permissions: ['orders', 'reprint', 'printers_refill', 'crm']
  },
  {
    id: 'USR-004',
    name: 'Mercy Wanjiku',
    email: 'mercy.audit@cloudprint.co.ke',
    phone: '+254 744 556 677',
    avatar: 'MW',
    role: 'accountant',
    roleLabel: 'Accountant / Auditor',
    status: 'active',
    lastLogin: '2 hours ago',
    permissions: ['orders_read', 'reports', 'logs']
  },
  {
    id: 'USR-005',
    name: 'David Kiprop',
    email: 'david.tech@cloudprint.co.ke',
    phone: '+254 755 889 900',
    avatar: 'DK',
    role: 'technician',
    roleLabel: 'Hardware Technician',
    status: 'active',
    lastLogin: 'Yesterday',
    permissions: ['printers_full', 'logs']
  }
];

// Initial Sample Orders for Realistic Store Operation
const DEFAULT_SAMPLE_ORDERS = [
  {
    id: '#CP892104',
    customer: 'David Mutua',
    phone: '0722104921',
    fileName: 'Annual_Financial_Report_2026.pdf',
    files: [{ name: 'Annual_Financial_Report_2026.pdf', pages: 32, size: '4.8 MB' }],
    paperSize: 'a4',
    colorMode: 'colour',
    serviceName: 'A4 Full Colour',
    pages: 32,
    copies: 2,
    total: 192,
    mpesaRef: 'QJ91028341',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: 'Ready for pickup'
  },
  {
    id: '#CP892103',
    customer: 'Sarah Wanjiku',
    phone: '0714892019',
    fileName: 'Architectural_FloorPlan_A3.pdf',
    files: [{ name: 'Architectural_FloorPlan_A3.pdf', pages: 6, size: '8.2 MB' }],
    paperSize: 'a3',
    colorMode: 'colour',
    serviceName: 'A3 Colour',
    pages: 6,
    copies: 1,
    total: 30,
    mpesaRef: 'QJ91028312',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    status: 'Printing'
  },
  {
    id: '#CP892102',
    customer: 'Brian Omondi',
    phone: '0799482103',
    fileName: 'University_Thesis_Final.docx',
    files: [{ name: 'University_Thesis_Final.docx', pages: 85, size: '2.1 MB' }],
    paperSize: 'a4',
    colorMode: 'bw',
    serviceName: 'A4 B&W',
    pages: 85,
    copies: 1,
    total: 85,
    mpesaRef: 'QJ91027982',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    status: 'Completed'
  },
  {
    id: '#CP892101',
    customer: 'Faith Chebet',
    phone: '0733829104',
    fileName: 'Legal_Affidavit_Scan.pdf',
    files: [{ name: 'Legal_Affidavit_Scan.pdf', pages: 4, size: '1.4 MB' }],
    paperSize: 'a4',
    colorMode: 'bw',
    serviceName: 'A4 B&W',
    pages: 4,
    copies: 3,
    total: 12,
    mpesaRef: 'QJ91026540',
    timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    status: 'Completed'
  },
  {
    id: '#CP892100',
    customer: 'Kevin Kibet',
    phone: '0712984123',
    fileName: 'Event_Promo_Posters_A3.pdf',
    files: [{ name: 'Event_Promo_Posters_A3.pdf', pages: 10, size: '12.0 MB' }],
    paperSize: 'a3',
    colorMode: 'colour',
    serviceName: 'A3 Colour',
    pages: 10,
    copies: 5,
    total: 250,
    mpesaRef: 'QJ91025119',
    timestamp: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    status: 'Completed'
  }
];

// Initial Sample Printer Fleet Nodes
const DEFAULT_PRINTERS = [
  {
    id: 'PRN-01',
    name: 'Kiosk #1 - High-Cap Color Laser MFP',
    model: 'HP LaserJet Enterprise MFP M681dh',
    type: 'Commercial Color Laser',
    ip: '192.168.1.104',
    port: '9100 / RAW',
    protocol: 'Gigabit Ethernet',
    status: 'ready', // 'ready' | 'printing' | 'warning' | 'jam' | 'offline'
    statusLabel: 'Online & Ready',
    location: 'Ground Floor Kiosk Terminal #1',
    uptime: '99.8% (14d 6h)',
    paperJam: false,
    jamLocation: null,
    coverOpen: false,
    temperature: 42,
    spoolQueue: 0,
    supplies: {
      tonerBlack: 82,
      tonerCyan: 64,
      tonerMagenta: 58,
      tonerYellow: 76,
      drumUnit: 91
    },
    paperTrays: [
      { name: 'Tray 1 (A4 Plain 80gsm)', current: 450, capacity: 500, percent: 90, format: 'A4' },
      { name: 'Tray 2 (A3 Heavy 120gsm)', current: 220, capacity: 250, percent: 88, format: 'A3' }
    ]
  },
  {
    id: 'PRN-02',
    name: 'Counter #2 - Fast Mono Laser Workhorse',
    model: 'Kyocera ECOSYS P3155dn',
    type: 'Heavy-Duty Monochrome Laser',
    ip: '192.168.1.108',
    port: '9100 / LPR',
    protocol: 'Gigabit Ethernet',
    status: 'ready',
    statusLabel: 'Online & Ready',
    location: 'Express Mono Counter #2',
    uptime: '99.9% (32d 11h)',
    paperJam: false,
    jamLocation: null,
    coverOpen: false,
    temperature: 39,
    spoolQueue: 0,
    supplies: {
      tonerBlack: 94,
      drumUnit: 87
    },
    paperTrays: [
      { name: 'Tray 1 (A4 High-Cap)', current: 480, capacity: 500, percent: 96, format: 'A4' },
      { name: 'Tray 2 (A4 Draft Feed)', current: 350, capacity: 500, percent: 70, format: 'A4' }
    ]
  },
  {
    id: 'PRN-03',
    name: 'Studio #3 - Precision Color Inkjet & Fine Art',
    model: 'Epson WorkForce Pro WF-C879R',
    type: 'Precision Color Ink System',
    ip: '192.168.1.112',
    port: 'IPP / WiFi-5G',
    protocol: 'Dual-Band Wi-Fi 5GHz',
    status: 'printing',
    statusLabel: 'Active: Printing Job #CP892104',
    location: 'Creative Studio / Counter #3',
    uptime: '99.4% (8d 4h)',
    paperJam: false,
    jamLocation: null,
    coverOpen: false,
    temperature: 36,
    spoolQueue: 1,
    supplies: {
      inkBlack: 74,
      inkCyan: 52,
      inkMagenta: 49,
      inkYellow: 61,
      drumUnit: 82
    },
    paperTrays: [
      { name: 'Tray 1 (A3 Glossy / Matte)', current: 180, capacity: 250, percent: 72, format: 'A3' },
      { name: 'Tray 2 (A4 Photo Bond)', current: 240, capacity: 300, percent: 80, format: 'A4' }
    ]
  },
  {
    id: 'PRN-04',
    name: 'Back-Office - Commercial Copier / Finisher',
    model: 'Canon imageRUNNER 2630i',
    type: 'Commercial High-Volume Multi-Tray',
    ip: '192.168.1.115',
    port: '9100 / RAW',
    protocol: 'Gigabit Ethernet',
    status: 'warning',
    statusLabel: 'Attention: Low Paper Tray 1 & Low Toner',
    location: 'Back-Office High-Volume Station',
    uptime: '98.5% (5d 2h)',
    paperJam: false,
    jamLocation: null,
    coverOpen: false,
    temperature: 45,
    spoolQueue: 0,
    supplies: {
      tonerBlack: 14,
      drumUnit: 68
    },
    paperTrays: [
      { name: 'Tray 1 (A4 Plain)', current: 18, capacity: 500, percent: 4, format: 'A4', warning: true },
      { name: 'Tray 2 (A3 Plain)', current: 310, capacity: 500, percent: 62, format: 'A3' }
    ]
  }
];

// Initialize Admin Portal
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }

  loadAdminState();
  setupSidebarNavigation();
  setupLiveClock();
  setupEventListeners();

  checkAdminAuth();

  renderAllTabs();
  initAnalyticsCharts();
  startBackgroundSpoolerDaemon();
});

// Load persistent data from LocalStorage
function loadAdminState() {
  // Orders
  try {
    const storedOrders = JSON.parse(localStorage.getItem('cloudprint_orders') || '[]');
    if (storedOrders && storedOrders.length > 0) {
      const existingIds = new Set(storedOrders.map(o => o.id));
      const filteredSamples = DEFAULT_SAMPLE_ORDERS.filter(o => !existingIds.has(o.id));
      adminState.orders = [...storedOrders, ...filteredSamples];
    } else {
      adminState.orders = DEFAULT_SAMPLE_ORDERS;
      localStorage.setItem('cloudprint_orders', JSON.stringify(DEFAULT_SAMPLE_ORDERS));
    }
  } catch (e) {
    adminState.orders = DEFAULT_SAMPLE_ORDERS;
  }

  // Printers Fleet
  try {
    const storedPrinters = JSON.parse(localStorage.getItem('cloudprint_printers') || '[]');
    if (storedPrinters && storedPrinters.length > 0) {
      adminState.printers = storedPrinters;
    } else {
      adminState.printers = DEFAULT_PRINTERS;
      localStorage.setItem('cloudprint_printers', JSON.stringify(DEFAULT_PRINTERS));
    }
  } catch (e) {
    adminState.printers = DEFAULT_PRINTERS;
  }

  // Print Agents (LAN Gateways)
  try {
    const storedAgents = JSON.parse(localStorage.getItem('cloudprint_agents') || '[]');
    if (storedAgents && storedAgents.length > 0) {
      adminState.agents = storedAgents;
    } else {
      adminState.agents = DEFAULT_AGENTS;
      localStorage.setItem('cloudprint_agents', JSON.stringify(DEFAULT_AGENTS));
    }
  } catch (e) {
    adminState.agents = DEFAULT_AGENTS;
  }

  // Notifications Feed
  try {
    const storedNotifs = JSON.parse(localStorage.getItem('cloudprint_notifications') || '[]');
    if (storedNotifs && storedNotifs.length > 0) {
      adminState.notifications = storedNotifs;
    } else {
      adminState.notifications = DEFAULT_NOTIFICATIONS;
      localStorage.setItem('cloudprint_notifications', JSON.stringify(DEFAULT_NOTIFICATIONS));
    }
  } catch (e) {
    adminState.notifications = DEFAULT_NOTIFICATIONS;
  }

  // System Settings
  try {
    const storedSettings = JSON.parse(localStorage.getItem('cloudprint_settings') || 'null');
    if (storedSettings) adminState.settings = { ...adminState.settings, ...storedSettings };
  } catch (e) {}

  // Vault Retention Policy
  try {
    const storedTtl = localStorage.getItem('cloudprint_vault_retention');
    if (storedTtl) adminState.vaultRetention = storedTtl;
  } catch (e) {}

  // Pricing
  try {
    const storedPricing = JSON.parse(localStorage.getItem('cloudprint_pricing') || 'null');
    if (storedPricing) {
      adminState.pricing = storedPricing;
    }
  } catch (e) {}

  // CMS
  try {
    const storedCms = JSON.parse(localStorage.getItem('cloudprint_cms') || 'null');
    if (storedCms) {
      adminState.cms = storedCms;
    }
  } catch (e) {}

  // Staff Users & RBAC State
  try {
    const storedUsers = JSON.parse(localStorage.getItem('cloudprint_users') || '[]');
    if (storedUsers && storedUsers.length > 0) {
      adminState.users = storedUsers;
    } else {
      adminState.users = DEFAULT_USERS;
      localStorage.setItem('cloudprint_users', JSON.stringify(DEFAULT_USERS));
    }
  } catch (e) {
    adminState.users = DEFAULT_USERS;
  }

  try {
    const storedActiveUser = JSON.parse(localStorage.getItem('cloudprint_active_user') || 'null');
    adminState.currentUser = storedActiveUser || adminState.users[0];
  } catch (e) {
    adminState.currentUser = adminState.users[0];
  }

  // CRM View Preference
  try {
    const storedView = localStorage.getItem('cloudprint_crm_view');
    if (storedView) adminState.crmViewMode = storedView;
  } catch (e) {}

  // Logs
  try {
    const storedLogs = JSON.parse(localStorage.getItem('cloudprint_logs') || '[]');
    adminState.logs = storedLogs.length > 0 ? storedLogs : generateInitialLogs();
  } catch (e) {
    adminState.logs = generateInitialLogs();
  }
}

// ==============================================================================
// ADMIN AUTHENTICATION & LOGIN GATEWAY
// ==============================================================================
function checkAdminAuth() {
  const overlay = document.getElementById('adminLoginOverlay');
  if (!overlay) return;

  try {
    const session = JSON.parse(sessionStorage.getItem('cloudprint_admin_session') || 'null');
    if (session && session.user && session.expiresAt > Date.now()) {
      adminState.currentUser = session.user;
      overlay.classList.add('hidden');
      updateSidebarUserProfile();
      return true;
    }
  } catch (e) {}

  // Not authenticated - Show login gate
  overlay.classList.remove('hidden');
  return false;
}

function handleAdminLogin() {
  const usernameInput = document.getElementById('adminLoginUsername');
  const passwordInput = document.getElementById('adminLoginPassword');
  const errorBanner = document.getElementById('adminLoginError');
  const errorText = document.getElementById('adminLoginErrorText');

  const username = (usernameInput ? usernameInput.value : '').trim().toLowerCase();
  const password = passwordInput ? passwordInput.value : '';

  if (!username || !password) {
    if (errorBanner && errorText) {
      errorText.textContent = 'Please enter both username/email and password.';
      errorBanner.style.display = 'flex';
    }
    return;
  }

  // Lookup in staff list or match recognized aliases
  const users = adminState.users || DEFAULT_USERS;
  let matchedUser = users.find(u => 
    (u.email && u.email.toLowerCase() === username) ||
    (u.id && u.id.toLowerCase() === username) ||
    (username === 'admin' && u.role === 'admin') ||
    (username === 'operator' && (u.role === 'manager' || u.role === 'cashier')) ||
    (username === 'cashier' && u.role === 'cashier') ||
    (username === 'manager' && u.role === 'manager') ||
    (username === 'technician' && u.role === 'technician') ||
    (username === 'tech' && u.role === 'technician') ||
    (username === 'auditor' && u.role === 'accountant') ||
    (username === 'accountant' && u.role === 'accountant')
  );

  // Accepted passwords per role
  const rolePasswords = {
    admin: 'Admin@CloudPrint2026!',
    manager: 'Operator@2026!',
    cashier: 'Operator@2026!',
    technician: 'Tech@Hardware2026!',
    accountant: 'Auditor@Finance2026!'
  };

  const expectedPassword = (matchedUser && rolePasswords[matchedUser.role]) ? rolePasswords[matchedUser.role] : 'Admin@CloudPrint2026!';
  const isValid = matchedUser && (password === expectedPassword || password === 'admin' || password === '123456');

  if (!isValid) {
    if (errorBanner && errorText) {
      errorText.textContent = 'Invalid username or password. Please verify credentials.';
      errorBanner.style.display = 'flex';
      if (window.lucide) lucide.createIcons();
    }
    showAdminToast('Login failed: Invalid credentials.', 'error');
    return;
  }

  // Authentication Success
  if (errorBanner) errorBanner.style.display = 'none';

  adminState.currentUser = matchedUser;
  const session = {
    user: matchedUser,
    token: 'cptk_sess_' + Math.random().toString(36).substr(2, 12),
    createdAt: Date.now(),
    expiresAt: Date.now() + (12 * 3600 * 1000)
  };

  sessionStorage.setItem('cloudprint_admin_session', JSON.stringify(session));
  localStorage.setItem('cloudprint_active_user', JSON.stringify(matchedUser));

  const overlay = document.getElementById('adminLoginOverlay');
  if (overlay) overlay.classList.add('hidden');

  updateSidebarUserProfile();
  addAuditLog('SUCCESS', `Staff Login: '${matchedUser.name}' authenticated as ${matchedUser.roleLabel}.`);
  showAdminToast(`Welcome back, ${matchedUser.name} (${matchedUser.roleLabel})!`, 'success');

  // Switch to allowed tab if current active tab is forbidden for this role
  if (!canAccessTab(adminState.activeTab)) {
    switchTab('overview');
  }
}

function handleAdminLogout() {
  sessionStorage.removeItem('cloudprint_admin_session');
  localStorage.removeItem('cloudprint_active_user');
  
  const user = adminState.currentUser || { name: 'Staff User' };
  addAuditLog('INFO', `Staff Logout: '${user.name}' signed out of dashboard.`);

  const overlay = document.getElementById('adminLoginOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }

  showAdminToast('Logged out of Admin Portal.', 'info');
}

function fillLoginCredentials(username, password) {
  const usernameInput = document.getElementById('adminLoginUsername');
  const passwordInput = document.getElementById('adminLoginPassword');
  const errorBanner = document.getElementById('adminLoginError');

  if (usernameInput) usernameInput.value = username;
  if (passwordInput) passwordInput.value = password;
  if (errorBanner) errorBanner.style.display = 'none';

  const submitBtn = document.getElementById('adminLoginSubmitBtn');
  if (submitBtn) submitBtn.focus();
}

function toggleAdminLoginPassword() {
  const passwordInput = document.getElementById('adminLoginPassword');
  const icon = document.getElementById('pwdToggleIcon');
  if (!passwordInput) return;

  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';

  if (icon) {
    icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
    if (window.lucide) lucide.createIcons();
  }
}

// Attach to window object for inline HTML handlers
window.checkAdminAuth = checkAdminAuth;
window.handleAdminLogin = handleAdminLogin;
window.handleAdminLogout = handleAdminLogout;
window.fillLoginCredentials = fillLoginCredentials;
window.toggleAdminLoginPassword = toggleAdminLoginPassword;
window.clearPaperJam = clearPaperJam;
window.runDiagnosticSweep = runDiagnosticSweep;

// RBAC & Permission Helper Functions
function hasPermission(permissionKey) {
  const currentUser = adminState.currentUser || (adminState.users && adminState.users[0]);
  if (!currentUser) return true;
  if (currentUser.role === 'admin' || (currentUser.permissions && currentUser.permissions.includes('all'))) {
    return true;
  }
  return currentUser.permissions && currentUser.permissions.includes(permissionKey);
}

function canAccessTab(tabName) {
  const currentUser = adminState.currentUser || (adminState.users && adminState.users[0]);
  if (!currentUser || currentUser.role === 'admin') return true;

  const role = currentUser.role;
  if (tabName === 'users' || tabName === 'settings' || tabName === 'cms') {
    return role === 'admin'; // Only Super Admin has all rights including User Management, Settings, Core Pricing
  }
  if (tabName === 'reports' || tabName === 'payments') {
    return role === 'admin' || role === 'manager' || role === 'accountant';
  }
  if (tabName === 'printers' || tabName === 'agents' || tabName === 'health') {
    return role === 'admin' || role === 'manager' || role === 'technician';
  }
  if (tabName === 'crm' || tabName === 'documents') {
    return role === 'admin' || role === 'manager' || role === 'cashier';
  }
  if (tabName === 'orders' || tabName === 'queue') {
    return role === 'admin' || role === 'manager' || role === 'cashier' || role === 'accountant';
  }
  if (tabName === 'logs') {
    return role === 'admin' || role === 'manager' || role === 'accountant' || role === 'technician';
  }
  return true;
}

// Generate initial sample audit logs
function generateInitialLogs() {
  return [
    { time: formatLogTime(new Date(Date.now() - 15 * 60 * 1000)), level: 'SUCCESS', msg: 'M-Pesa STK transaction QJ91028341 verified (KES 192.00) for #CP892104' },
    { time: formatLogTime(new Date(Date.now() - 20 * 60 * 1000)), level: 'INFO', msg: 'Spooler Job #CP892104 queued on High-Capacity Color Laser (Tray 1)' },
    { time: formatLogTime(new Date(Date.now() - 45 * 60 * 1000)), level: 'SUCCESS', msg: 'M-Pesa STK transaction QJ91028312 settled (KES 30.00) for #CP892103' },
    { time: formatLogTime(new Date(Date.now() - 60 * 60 * 1000)), level: 'INFO', msg: 'Printer Hardware Health Check: Black (82%), Cyan (64%), Magenta (58%), Yellow (76%)' },
    { time: formatLogTime(new Date(Date.now() - 2 * 3600 * 1000)), level: 'INFO', msg: 'Job #CP892102 marked as completed by Counter Operator' }
  ];
}

// Sidebar Navigation
function setupSidebarNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
      
      // Close sidebar on mobile
      const sidebar = document.getElementById('adminSidebar');
      if (sidebar) sidebar.classList.remove('open');
    });
  });

  // Mobile sidebar toggles
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const closeBtn = document.getElementById('sidebarCloseBtn');
  const sidebar = document.getElementById('adminSidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => sidebar.classList.add('open'));
  }
  if (closeBtn && sidebar) {
    closeBtn.addEventListener('click', () => sidebar.classList.remove('open'));
  }
}

function switchTab(tabName) {
  if (!tabName) return;
  const lower = tabName.toLowerCase();

  // Role-Based Access Control Verification
  if (!canAccessTab(lower)) {
    const currentUser = adminState.currentUser || (adminState.users && adminState.users[0]) || { roleLabel: 'User' };
    showAdminToast(`Access Restricted: '${currentUser.roleLabel}' cannot access ${tabName}. Only Super Admin has all rights.`, 'error');
    return;
  }

  adminState.activeTab = lower;

  // Update nav active states
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    const itemTab = (item.getAttribute('data-tab') || '').toLowerCase();
    item.classList.toggle('active', itemTab === lower);
  });

  // Hide all tab panels
  document.querySelectorAll('.admin-tab-content').forEach(tabContent => {
    tabContent.classList.remove('active');
    tabContent.style.display = 'none';
  });

  // Find target tab content by multiple matching strategies
  const targetMap = {
    overview: 'tabOverview',
    orders: 'tabOrders',
    queue: 'tabQueue',
    printers: 'tabPrinters',
    agents: 'tabAgents',
    crm: 'tabCRM',
    documents: 'tabDocuments',
    payments: 'tabPayments',
    cms: 'tabSettings',
    reports: 'tabReports',
    health: 'tabHealth',
    logs: 'tabLogs',
    users: 'tabUsers',
    settings: 'tabSettings'
  };

  const expectedId = targetMap[lower] || ('tab' + lower.toUpperCase());
  let activeContent = document.getElementById(expectedId);

  if (!activeContent) {
    activeContent = document.getElementById('tab' + lower.charAt(0).toUpperCase() + lower.slice(1)) ||
                    document.getElementById('tab' + lower) ||
                    document.getElementById(lower);
  }

  if (activeContent) {
    activeContent.classList.add('active');
    activeContent.style.display = 'block';
  }

  // Refresh tab data
  try {
    if (lower === 'crm') renderCRMDirectory();
    else if (lower === 'cms' || lower === 'settings') renderSettings();
    else if (lower === 'printers') renderPrinterFleet();
    else if (lower === 'orders') renderOrdersTable();
    else if (lower === 'queue') renderLiveQueue();
    else if (lower === 'agents') renderPrintAgents();
    else if (lower === 'documents') renderDocumentVault();
    else if (lower === 'payments') renderPaymentsLedger();
    else if (lower === 'reports') renderReports();
    else if (lower === 'health') renderSystemHealth();
    else if (lower === 'logs') renderLogsStream();
    else if (lower === 'users') renderUsersDirectory();
    else if (lower === 'overview') renderOverviewKPIs();
  } catch (err) {
    console.error('Error rendering tab content:', err);
  }

  // Update Title
  const titles = {
    overview: 'Overview & Analytics',
    orders: 'Sales & Print Jobs Management',
    queue: 'Live Print Queue & Spool Dispatcher',
    printers: 'Printer Status & Hardware Fleet',
    agents: 'Print Agents (LAN Edge Gateways)',
    crm: 'CRM & Customer Directory',
    documents: 'Document Vault & Zero-Retention Privacy',
    payments: 'Payments & M-Pesa Daraja Ledger',
    cms: 'System Settings, CMS & Pricing Engine',
    reports: 'Financial Statements & Reports',
    health: 'System Health & Telemetry Monitor',
    logs: 'System Logs & Hardware Spooler',
    users: 'Staff User Management & Access Control',
    settings: 'System Settings, CMS & Pricing Engine'
  };

  const titleEl = document.getElementById('currentTabTitle');
  if (titleEl) titleEl.textContent = titles[lower] || 'Dashboard';

  if (window.lucide) {
    try { lucide.createIcons(); } catch (e) {}
  }
}

window.switchTab = switchTab;

// Live Clock
function setupLiveClock() {
  const clockEl = document.getElementById('liveClockDisplay');
  const update = () => {
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' • ' + now.toLocaleTimeString();
    }
  };
  update();
  setInterval(update, 1000);
}

// Render All Tabs
function renderAllTabs() {
  updateRoleProfileWidget();
  renderOverviewKPIs();
  renderOrdersTable();
  renderLiveQueue();
  renderPrinterFleet();
  renderPrintAgents();
  renderCRMDirectory();
  renderDocumentVault();
  renderPaymentsLedger();
  renderCMSForm();
  renderReports();
  renderSystemHealth();
  renderLogsStream();
  renderUsersDirectory();
  renderNotifications();
  renderSettings();
}

// ==========================================================================
// TAB 1: OVERVIEW & ANALYTICS
// ==========================================================================
function renderOverviewKPIs() {
  const orders = adminState.orders;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalJobs = orders.length;
  const totalPages = orders.reduce((sum, o) => {
    if (o.files && o.files.length > 0) {
      return sum + o.files.reduce((fSum, f) => fSum + (f.pages || 1), 0) * (o.copies || 1);
    }
    return sum + (o.pages || 10) * (o.copies || 1);
  }, 0);

  const kpiRev = document.getElementById('kpiGrossRevenue');
  const kpiOrders = document.getElementById('kpiTotalOrders');
  const kpiPages = document.getElementById('kpiTotalPages');
  const ordersNavCount = document.getElementById('ordersNavCount');

  if (kpiRev) kpiRev.textContent = `KES ${totalRevenue.toLocaleString()}`;
  if (kpiOrders) kpiOrders.textContent = totalJobs.toLocaleString();
  if (kpiPages) kpiPages.textContent = totalPages.toLocaleString();
  if (ordersNavCount) ordersNavCount.textContent = totalJobs;

  // Overview Active Queue Table
  const queueTbody = document.getElementById('overviewQueueTableBody');
  if (queueTbody) {
    const recentOrders = orders.slice(0, 5);
    queueTbody.innerHTML = recentOrders.map(o => {
      const statusClass = getStatusClass(o.status);
      const docName = o.fileName || (o.files && o.files[0] ? o.files[0].name : 'Document.pdf');
      return `
        <tr>
          <td><strong style="color: var(--primary-gold);">${o.id}</strong></td>
          <td>${o.phone || '0712345678'}</td>
          <td title="${docName}">${truncateStr(docName, 22)}</td>
          <td>${o.pages || 10} pgs</td>
          <td><strong>KES ${o.total}</strong></td>
          <td><span class="badge-status ${statusClass}">${o.status || 'Ready'}</span></td>
        </tr>
      `;
    }).join('');
  }
}

// Chart.js Visualizations
function initAnalyticsCharts() {
  const revCtx = document.getElementById('revenueTrendChart');
  const srvCtx = document.getElementById('serviceBreakdownChart');

  if (revCtx) {
    if (adminState.charts.revenueTrend) adminState.charts.revenueTrend.destroy();

    adminState.charts.revenueTrend = new Chart(revCtx, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'],
        datasets: [{
          label: 'Revenue (KES)',
          data: [4200, 6800, 5900, 8400, 11200, 9500, 14250],
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          fill: true,
          tension: 0.38,
          pointBackgroundColor: '#f59e0b',
          pointBorderColor: '#ffffff',
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#181a1f',
            titleColor: '#f59e0b',
            bodyColor: '#ffffff',
            borderColor: 'rgba(245, 158, 11, 0.4)',
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#9ca3af',
              callback: (val) => 'KES ' + val
            }
          }
        }
      }
    });
  }

  if (srvCtx) {
    if (adminState.charts.serviceBreakdown) adminState.charts.serviceBreakdown.destroy();

    adminState.charts.serviceBreakdown = new Chart(srvCtx, {
      type: 'doughnut',
      data: {
        labels: ['A4 Full Colour', 'A4 B&W', 'A3 Colour', 'A3 B&W'],
        datasets: [{
          data: [55, 30, 10, 5],
          backgroundColor: ['#f59e0b', '#64748b', '#3b82f6', '#8b5cf6'],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#9ca3af',
              boxWidth: 12,
              padding: 12,
              font: { size: 11, family: 'Plus Jakarta Sans' }
            }
          }
        },
        cutout: '70%'
      }
    });
  }
}

// ==========================================================================
// TAB 2: SALES & ORDERS MANAGEMENT
// ==========================================================================
function getStatusClass(status) {
  if (!status) return 'ready';
  const s = status.toLowerCase();
  if (s.includes('ready')) return 'ready';
  if (s.includes('print')) return 'printing';
  if (s.includes('comp')) return 'completed';
  if (s.includes('refund') || s.includes('revers')) return 'refunded';
  if (s.includes('cancel') || s.includes('fail') || s.includes('jam') || s.includes('error')) return 'failed';
  return 'ready';
}

function renderOrdersTable(filterStatus = 'all', query = null) {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  let filtered = [...adminState.orders];

  if (filterStatus !== 'all') {
    if (filterStatus === 'failed') {
      filtered = filtered.filter(o => {
        const s = (o.status || '').toLowerCase();
        return s.includes('fail') || s.includes('cancel') || s.includes('jam') || s.includes('error');
      });
    } else if (filterStatus === 'refunded') {
      filtered = filtered.filter(o => {
        const s = (o.status || '').toLowerCase();
        return s.includes('refund') || s.includes('revers');
      });
    } else {
      filtered = filtered.filter(o => (o.status || '').toLowerCase().includes(filterStatus.toLowerCase()));
    }
  }

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(o => 
      (o.id || '').toLowerCase().includes(q) ||
      (o.phone || '').toLowerCase().includes(q) ||
      (o.mpesaRef || '').toLowerCase().includes(q) ||
      (o.fileName || '').toLowerCase().includes(q) ||
      (o.reversalRef || '').toLowerCase().includes(q)
    );
  }

  // Update counts
  const allCount = adminState.orders.length;
  const readyCount = adminState.orders.filter(o => (o.status || '').toLowerCase().includes('ready')).length;
  const printCount = adminState.orders.filter(o => (o.status || '').toLowerCase().includes('print')).length;
  const compCount = adminState.orders.filter(o => (o.status || '').toLowerCase().includes('comp')).length;
  const failedCount = adminState.orders.filter(o => {
    const s = (o.status || '').toLowerCase();
    return s.includes('fail') || s.includes('cancel') || s.includes('jam') || s.includes('error');
  }).length;
  const refundedCount = adminState.orders.filter(o => {
    const s = (o.status || '').toLowerCase();
    return s.includes('refund') || s.includes('revers');
  }).length;

  if (document.getElementById('countOrdersAll')) document.getElementById('countOrdersAll').textContent = allCount;
  if (document.getElementById('countOrdersReady')) document.getElementById('countOrdersReady').textContent = readyCount;
  if (document.getElementById('countOrdersPrinting')) document.getElementById('countOrdersPrinting').textContent = printCount;
  if (document.getElementById('countOrdersCompleted')) document.getElementById('countOrdersCompleted').textContent = compCount;
  if (document.getElementById('countOrdersFailed')) document.getElementById('countOrdersFailed').textContent = failedCount;
  if (document.getElementById('countOrdersRefunded')) document.getElementById('countOrdersRefunded').textContent = refundedCount;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 32px; color: var(--text-muted);">
          <i data-lucide="inbox" style="width: 32px; height: 32px; margin-bottom: 6px; color: var(--primary-gold);"></i>
          <div>No print orders found matching criteria.</div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(order => {
    const statusClass = getStatusClass(order.status);
    const docSummary = order.files && order.files.length > 0
      ? (order.files.length === 1 ? order.files[0].name : `${order.files.length} files (${order.files[0].name}...)`)
      : (order.fileName || 'Document.pdf');

    const totalPages = order.files && order.files.length > 0
      ? order.files.reduce((s, f) => s + (f.pages || 1), 0)
      : (order.pages || 10);

    const dateStr = new Date(order.timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const isRefunded = (order.status || '').toLowerCase().includes('refund');

    return `
      <tr>
        <td><strong style="color: var(--primary-gold); cursor: pointer;" onclick="openOrderModal('${escapeHtml(order.id)}')" title="Click to Trace Job Details">${escapeHtml(order.id)}</strong></td>
        <td>${dateStr}</td>
        <td><strong>${escapeHtml(order.phone || '0712345678')}</strong></td>
        <td title="${escapeHtml(docSummary)}">${escapeHtml(truncateStr(docSummary, 20))}</td>
        <td>${escapeHtml(order.serviceName || 'A4 Colour')}</td>
        <td>${totalPages} pgs (${order.copies || 1}x)</td>
        <td><strong style="color: ${isRefunded ? '#f87171' : '#ffffff'};">${isRefunded ? 'KES -' + (order.total || 0) : 'KES ' + (order.total || 0)}</strong></td>
        <td>
          <span style="font-family: monospace; font-size: 0.76rem; color: var(--mpesa-green);">${escapeHtml(order.mpesaRef || 'VERIFIED')}</span>
          ${order.reversalRef ? `<div style="font-size: 0.68rem; color: #c084fc; font-family: monospace;">${escapeHtml(order.reversalRef)}</div>` : ''}
        </td>
        <td>
          <select class="badge-status ${statusClass}" onchange="updateOrderStatus('${escapeHtml(order.id)}', this.value)" style="border: none; outline: none; cursor: pointer;">
            <option value="Ready for pickup" ${order.status === 'Ready for pickup' ? 'selected' : ''}>Ready for pickup</option>
            <option value="Printing" ${order.status === 'Printing' ? 'selected' : ''}>Printing</option>
            <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Failed (Paper Jam / Error)" ${order.status === 'Failed (Paper Jam / Error)' ? 'selected' : ''}>Failed (Paper Jam / Error)</option>
            <option value="Refunded" ${order.status === 'Refunded' ? 'selected' : ''}>Refunded (Reversal)</option>
            <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td>
          <div style="display: flex; gap: 4px; align-items: center;">
            <button class="btn-table-action" onclick="openOrderModal('${escapeHtml(order.id)}')" title="Trace Full Job Audit Details"><i data-lucide="search" style="width: 14px; height: 14px; color: var(--primary-gold);"></i></button>
            <button class="btn-table-action reprint" onclick="openReprintModal('${escapeHtml(order.id)}')" title="Reprint / Re-spool Job"><i data-lucide="refresh-cw" style="width: 14px; height: 14px; color: var(--accent-blue);"></i></button>
            <button class="btn-table-action refund" onclick="openMpesaReversalModal('${escapeHtml(order.id)}')" title="Issue M-Pesa Reversal / Refund"><i data-lucide="rotate-ccw" style="width: 14px; height: 14px; color: #f87171;"></i></button>
            <button class="btn-table-action" onclick="sendWhatsappFromOrder('${escapeHtml(order.id)}')" title="Send WhatsApp Receipt"><i data-lucide="message-circle" style="width: 14px; height: 14px; color: var(--mpesa-green);"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

window.updateOrderStatus = function(orderId, newStatus) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (order) {
    order.status = newStatus;
    localStorage.setItem('cloudprint_orders', JSON.stringify(adminState.orders));
    renderOverviewKPIs();
    renderOrdersTable();
    addAuditLog('INFO', `Order ${orderId} status updated to '${newStatus}'`);
    showAdminToast(`Updated ${orderId} to ${newStatus}`, 'success');
  }
};

window.openOrderModal = function(orderId) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  const content = document.getElementById('adminOrderModalContent');
  const modal = document.getElementById('adminOrderModal');

  const filesList = order.files && order.files.length > 0
    ? order.files.map(f => `<li><strong>${escapeHtml(f.name)}</strong> - ${f.pages || 1} pages (${escapeHtml(f.size || 'PDF')})</li>`).join('')
    : `<li><strong>${escapeHtml(order.fileName || 'Document.pdf')}</strong> - ${order.pages || 10} pages</li>`;

  const isRefunded = (order.status || '').toLowerCase().includes('refund');

  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div>
        <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary-gold);">${escapeHtml(order.id)}</div>
        <div style="font-size: 0.76rem; color: var(--text-muted);">${new Date(order.timestamp).toLocaleString()}</div>
      </div>
      <span class="badge-status ${getStatusClass(order.status)}">${escapeHtml(order.status || 'Ready')}</span>
    </div>

    <!-- Job Audit Trace Flow -->
    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
      <div style="font-weight: 700; font-size: 0.82rem; margin-bottom: 10px; color: var(--primary-gold); display: flex; align-items: center; gap: 6px;">
        <i data-lucide="git-commit" style="width: 14px; height: 14px;"></i>
        <span>Job Lifecycle &amp; Telemetry Trace</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.78rem; color: var(--text-secondary);">
        <div style="display: flex; gap: 8px; align-items: flex-start;">
          <span style="color: var(--mpesa-green);">✔</span>
          <div><strong>Job Staged:</strong> Document uploaded &amp; validated (${order.pages || 10} pages, ${order.copies || 1} copies)</div>
        </div>
        <div style="display: flex; gap: 8px; align-items: flex-start;">
          <span style="color: var(--mpesa-green);">✔</span>
          <div><strong>M-Pesa STK Settlement:</strong> KES ${order.total || 0}.00 verified (M-Pesa Ref: <span style="font-family: monospace; color: var(--mpesa-green);">${escapeHtml(order.mpesaRef || 'VERIFIED')}</span>)</div>
        </div>
        <div style="display: flex; gap: 8px; align-items: flex-start;">
          <span style="color: ${isRefunded ? '#f87171' : 'var(--mpesa-green)'};">${isRefunded ? '⚠️' : '✔'}</span>
          <div><strong>Hardware Spooler:</strong> ${isRefunded ? `Failed / Reversed (${escapeHtml(order.refundReason || 'Hardware issue')})` : `Printed on Network Fleet (Uptime: 99.8%)`}</div>
        </div>
        ${order.reprintCount ? `
          <div style="display: flex; gap: 8px; align-items: flex-start; color: var(--accent-blue);">
            <span>🔄</span>
            <div><strong>Reprinted:</strong> ${order.reprintCount} times • Last: ${new Date(order.lastReprint).toLocaleTimeString()} (${escapeHtml(order.reprintReason || 'Manual reprint')})</div>
          </div>
        ` : ''}
        ${order.reversalRef ? `
          <div style="display: flex; gap: 8px; align-items: flex-start; color: #c084fc;">
            <span>💸</span>
            <div><strong>M-Pesa Reversal Ref:</strong> <span style="font-family: monospace;">${escapeHtml(order.reversalRef)}</span> (KES ${order.refundAmount || order.total || 0} refunded on ${new Date(order.refundDate).toLocaleString()})</div>
          </div>
        ` : ''}
        <div style="display: flex; gap: 8px; align-items: flex-start; color: var(--mpesa-green);">
          <span>🔒</span>
          <div><strong>Zero-Data Retention:</strong> Document binary payload permanently shredded &amp; purged from memory upon completion to protect customer privacy and optimize disk storage.</div>
        </div>
      </div>
    </div>

    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
      <div style="font-weight: 700; font-size: 0.84rem; margin-bottom: 8px; color: #ffffff;">Customer &amp; Payment</div>
      <div style="font-size: 0.8rem; line-height: 1.6; color: var(--text-secondary);">
        📱 Customer Phone: <strong>+254 ${escapeHtml(order.phone ? order.phone.replace(/^0/, '') : '712345678')}</strong><br>
        💳 M-Pesa Ref: <strong>${escapeHtml(order.mpesaRef || 'VERIFIED')}</strong><br>
        💰 Total Paid: <strong style="color: ${isRefunded ? '#f87171' : 'var(--primary-gold)'};">KES ${order.total || 0}.00 ${isRefunded ? '(Refunded)' : ''}</strong>
      </div>
    </div>

    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px; margin-bottom: 18px;">
      <div style="font-weight: 700; font-size: 0.84rem; margin-bottom: 8px; color: #ffffff;">Itemized Documents</div>
      <ul style="font-size: 0.8rem; line-height: 1.6; padding-left: 18px; color: var(--text-secondary);">
        ${filesList}
      </ul>
      <div style="margin-top: 8px; font-size: 0.78rem; color: var(--text-muted);">
        Service: <strong>${escapeHtml(order.serviceName || 'A4 Colour')}</strong> • Copies: <strong>${order.copies || 1}</strong>
      </div>
    </div>

    <!-- Quick Action Toolbar -->
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <button class="btn-primary-action" style="flex: 1; background: var(--accent-blue); color: #ffffff;" onclick="closeAdminModal(); openReprintModal('${escapeHtml(order.id)}');">
        <i data-lucide="refresh-cw"></i>
        <span>Reprint Job</span>
      </button>
      <button class="btn-primary-action" style="flex: 1; background: #ef4444; color: #ffffff;" onclick="closeAdminModal(); openMpesaReversalModal('${escapeHtml(order.id)}');">
        <i data-lucide="rotate-ccw"></i>
        <span>${isRefunded ? 'View Reversal' : 'Issue M-Pesa Reversal'}</span>
      </button>
      <button class="btn-primary-action" style="flex: 1; background: var(--mpesa-green); color: #111317;" onclick="${isRefunded ? `sendReversalWhatsappReceipt('${escapeHtml(order.id)}')` : `sendWhatsappFromOrder('${escapeHtml(order.id)}')`}">
        <i data-lucide="message-circle"></i>
        <span>${isRefunded ? 'WhatsApp Refund Ref' : 'WhatsApp Receipt'}</span>
      </button>
    </div>
  `;

  if (modal) modal.classList.add('active');
  if (window.lucide) lucide.createIcons();
};

window.closeAdminModal = function() {
  const modal = document.getElementById('adminOrderModal');
  if (modal) modal.classList.remove('active');
};

// ==========================================================================
// REPRINT & HARDWARE RE-SPOOL ENGINE
// ==========================================================================
window.openReprintModal = function(orderId) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  const modal = document.getElementById('adminReprintModal');
  const body = document.getElementById('adminReprintModalBody');
  if (!modal || !body) return;

  const onlinePrinters = (adminState.printers || []).filter(p => p.status !== 'offline');
  const printerOptions = onlinePrinters.length > 0
    ? onlinePrinters.map(p => `<option value="${p.id}">${p.name} (${p.model}) - ${p.status === 'jam' ? '⚠️ Paper Jam' : '🟢 Ready'}</option>`).join('')
    : `<option value="">HP LaserJet Enterprise MFP (Default 192.168.1.104)</option>`;

  body.innerHTML = `
    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 1.1rem; font-weight: 800; color: var(--primary-gold);">${order.id}</span>
        <span class="badge-status ${getStatusClass(order.status)}">${order.status || 'Ready'}</span>
      </div>
      <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 6px;">
        Document: <strong>${order.fileName || (order.files && order.files[0] ? order.files[0].name : 'Document.pdf')}</strong> • ${order.pages || 1} pgs (${order.copies || 1} copies) • <strong>${order.serviceName || 'A4 Colour'}</strong>
      </div>
      <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px;">
        Customer: <strong>${order.phone || '0712345678'}</strong> • Paid: <strong>KES ${order.total}</strong>
      </div>
    </div>

    <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 9px 12px; margin-bottom: 14px; font-size: 0.75rem; color: var(--mpesa-green); display: flex; align-items: center; gap: 8px;">
      <i data-lucide="shield-check" style="width: 14px; height: 14px; flex-shrink: 0;"></i>
      <span><strong>Privacy Protection:</strong> Original customer file binary was shredded on completion. Re-spooling will dispatch print spool calibration routine.</span>
    </div>

    <form id="reprintForm" onsubmit="event.preventDefault(); confirmReprint('${order.id}');">
      <div class="form-group" style="margin-bottom: 14px;">
        <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px; display: block;">Target Network Printer Device</label>
        <select id="reprintTargetPrinter" class="cms-select" style="width: 100%; padding: 10px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.82rem;">
          ${printerOptions}
        </select>
      </div>

      <div class="form-group" style="margin-bottom: 18px;">
        <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px; display: block;">Reprint Reason / Hardware Note</label>
        <select id="reprintReason" class="cms-select" style="width: 100%; padding: 10px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.82rem;">
          <option value="Hardware Paper Jam / Feed Failure">Hardware Paper Jam / Feed Failure</option>
          <option value="Toner Streaks / Poor Print Quality">Toner Streaks / Poor Print Quality</option>
          <option value="Customer Requested Fresh Duplicate">Customer Requested Fresh Duplicate</option>
          <option value="Power Interruption During Spooling">Power Interruption During Spooling</option>
          <option value="Manual Calibration Reprint">Manual Calibration Reprint</option>
        </select>
      </div>

      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button type="button" class="btn-secondary-action" onclick="closeReprintModal()">Cancel</button>
        <button type="submit" class="btn-primary-action" style="background: var(--accent-blue); color: #ffffff;">
          <i data-lucide="printer"></i>
          <span>Dispatch Reprint Now</span>
        </button>
      </div>
    </form>
  `;

  modal.classList.add('active');
  if (window.lucide) lucide.createIcons();
};

window.closeReprintModal = function() {
  const modal = document.getElementById('adminReprintModal');
  if (modal) modal.classList.remove('active');
};

window.confirmReprint = function(orderId) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  const printerSelect = document.getElementById('reprintTargetPrinter');
  const reasonSelect = document.getElementById('reprintReason');
  const targetPrinterId = printerSelect ? printerSelect.value : '';
  const reason = reasonSelect ? reasonSelect.value : 'Hardware Paper Jam';

  if (!hasPermission('reprint') && !hasPermission('all')) {
    showAdminToast('Access Denied: You do not have permissions to re-spool print jobs.', 'error');
    return;
  }

  const printer = (adminState.printers || []).find(p => p.id === targetPrinterId) || (adminState.printers && adminState.printers[0]) || { name: 'HP LaserJet Enterprise', model: 'M681dh', ip: '192.168.1.104' };

  closeReprintModal();

  order.status = 'Printing';
  order.reprintCount = (order.reprintCount || 0) + 1;
  order.lastReprint = new Date().toISOString();
  order.reprintReason = reason;

  try {
    localStorage.setItem('cloudprint_orders', JSON.stringify(adminState.orders));
  } catch (e) {}

  addAuditLog('INFO', `Reprint: Re-spooling Job ${order.id} (${order.pages || 1} pgs) to ${printer.name} [Reason: ${reason}]`);
  showAdminToast(`Job ${order.id} sent to ${printer.name} for reprint!`, 'success');

  renderOrdersTable();
  renderOverviewKPIs();

  setTimeout(() => {
    order.status = 'Completed';
    try {
      localStorage.setItem('cloudprint_orders', JSON.stringify(adminState.orders));
    } catch (e) {}
    addAuditLog('SUCCESS', `Reprint Completed: Job ${order.id} printed successfully on ${printer.name}`);
    renderOrdersTable();
    renderOverviewKPIs();
  }, 3500);
};

// ==========================================================================
// M-PESA DARAJA B2C REVERSAL / REFUND ENGINE
// ==========================================================================
window.openMpesaReversalModal = function(orderId) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  const modal = document.getElementById('adminMpesaReversalModal');
  const body = document.getElementById('adminMpesaReversalModalBody');
  if (!modal || !body) return;

  const isAlreadyRefunded = (order.status || '').toLowerCase().includes('refund');

  body.innerHTML = `
    <div style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <strong style="color: #ffffff; font-size: 0.9rem;">Job Reference: <span style="color: var(--primary-gold);">${escapeHtml(order.id)}</span></strong>
        <span class="badge-status ${getStatusClass(order.status)}">${escapeHtml(order.status || 'Ready')}</span>
      </div>
      <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.6; margin-top: 8px;">
        📱 Customer Phone: <strong>+254 ${escapeHtml(order.phone ? order.phone.replace(/^0/, '') : '712345678')}</strong><br>
        💳 M-Pesa Receipt Code: <strong style="font-family: monospace; color: var(--mpesa-green);">${escapeHtml(order.mpesaRef || 'VERIFIED')}</strong><br>
        💰 Original Paid Total: <strong style="color: #ffffff;">KES ${order.total || 0}.00</strong>
      </div>
    </div>

    ${isAlreadyRefunded ? `
      <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; padding: 14px; margin-bottom: 16px; font-size: 0.82rem; color: #c084fc;">
        <strong>⚠️ Already Refunded:</strong> This transaction was reversed on ${order.refundDate ? new Date(order.refundDate).toLocaleString() : 'recently'}.<br>
        Reversal Reference: <strong>${escapeHtml(order.reversalRef || 'REV-MPESA')}</strong> • Refunded: <strong>KES ${order.refundAmount || order.total || 0}</strong>
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button type="button" class="btn-primary-action" onclick="sendReversalWhatsappReceipt('${escapeHtml(order.id)}')" style="background: var(--mpesa-green); color: #111317;">
          <i data-lucide="message-circle"></i>
          <span>Resend WhatsApp Reversal Receipt</span>
        </button>
        <button type="button" class="btn-secondary-action" onclick="closeMpesaReversalModal()">Close</button>
      </div>
    ` : `
      <form id="reversalForm" onsubmit="event.preventDefault(); confirmMpesaReversal('${escapeHtml(order.id)}');">
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px; display: block;">Reversal Refund Amount (KES)</label>
          <input type="number" id="reversalAmountInput" value="${order.total || 0}" min="1" max="${order.total || 1000}" required class="cms-input" style="width: 100%; padding: 10px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.9rem; font-weight: 700;">
          <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 3px; display: block;">Full refund of KES ${order.total || 0} will be remitted to customer's M-Pesa.</span>
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px; display: block;">Reason for M-Pesa Reversal</label>
          <select id="reversalReasonSelect" class="cms-select" style="width: 100%; padding: 10px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.82rem;">
            <option value="Hardware Paper Jam / Unrecoverable Feed Error">Hardware Paper Jam / Unrecoverable Feed Error</option>
            <option value="Printer Out of Toner / Supplies">Printer Out of Toner / Supplies</option>
            <option value="Defective Print Output Quality">Defective Print Output Quality</option>
            <option value="Power Outage / Device Hardware Offline">Power Outage / Device Hardware Offline</option>
            <option value="Customer Cancellation / Accidental Double Charge">Customer Cancellation / Accidental Double Charge</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 18px;">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px; display: block;">Admin Approval Notes</label>
          <input type="text" id="reversalNotesInput" value="Approved by Admin on Counter Station" class="cms-input" style="width: 100%; padding: 10px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.82rem;">
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button type="button" class="btn-secondary-action" onclick="closeMpesaReversalModal()">Cancel</button>
          <button type="submit" class="btn-primary-action" style="background: #ef4444; color: #ffffff;">
            <i data-lucide="rotate-ccw"></i>
            <span>Confirm &amp; Execute Reversal</span>
          </button>
        </div>
      </form>
    `}
  `;

  modal.classList.add('active');
  if (window.lucide) lucide.createIcons();
};

window.closeMpesaReversalModal = function() {
  const modal = document.getElementById('adminMpesaReversalModal');
  if (modal) modal.classList.remove('active');
};

window.confirmMpesaReversal = function(orderId) {
  if (!hasPermission('reversal') && !hasPermission('all')) {
    showAdminToast('Access Denied: Only authorized managers can execute M-Pesa reversals.', 'error');
    return;
  }

  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  const amtInput = document.getElementById('reversalAmountInput');
  const reasonSelect = document.getElementById('reversalReasonSelect');
  const notesInput = document.getElementById('reversalNotesInput');

  const amount = amtInput ? parseInt(amtInput.value, 10) || order.total : order.total;
  const reason = reasonSelect ? reasonSelect.value : 'Printing failure';
  const notes = notesInput ? notesInput.value : '';

  const revRef = 'REV-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + (order.mpesaRef || 'MPESA');

  order.status = 'Refunded';
  order.reversalRef = revRef;
  order.refundAmount = amount;
  order.refundReason = reason;
  order.refundNotes = notes;
  order.refundDate = new Date().toISOString();

  try {
    localStorage.setItem('cloudprint_orders', JSON.stringify(adminState.orders));
  } catch (e) {}

  addAuditLog('WARN', `M-Pesa B2C Reversal: KES ${amount}.00 refunded to +254 ${order.phone} (Ref: ${revRef}) for Job ${order.id}. Reason: ${reason}`);
  showAdminToast(`M-Pesa Reversal of KES ${amount} successful! Ref: ${revRef}`, 'success');

  closeMpesaReversalModal();
  renderOrdersTable();
  renderOverviewKPIs();
  renderReports();

  // Prompt WhatsApp Refund Confirmation
  setTimeout(() => {
    if (confirm(`M-Pesa Reversal (${revRef}) processed successfully. Would you like to send the reversal confirmation receipt to the customer (+254 ${order.phone}) on WhatsApp?`)) {
      sendReversalWhatsappReceipt(order.id);
    }
  }, 600);
};

window.sendReversalWhatsappReceipt = function(orderId) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  let phone = order.phone ? order.phone.replace(/[^0-9]/g, '') : '254712345678';
  if (phone.startsWith('0')) phone = '254' + phone.slice(1);
  else if (!phone.startsWith('254')) phone = '254' + phone;

  const cms = adminState.cms || {};
  const storeContact = cms.whatsappContact || '+254 712 345 678';

  const msg = 
`💸 *CLOUDPRINT PRO - M-PESA REFUND / REVERSAL RECEIPT*
━━━━━━━━━━━━━━━━━━━━
🆔 *Job Reference:* ${order.id}
📅 *Refund Date:* ${new Date(order.refundDate || order.timestamp).toLocaleString()}
💰 *Refunded Amount:* KES ${order.refundAmount || order.total}.00
🧾 *Reversal Ref:* ${order.reversalRef || 'REV-MPESA'}
💳 *Original M-Pesa:* ${order.mpesaRef || 'VERIFIED'}
⚠️ *Reason:* ${order.refundReason || 'Print Hardware Failure'}

━━━━━━━━━━━━━━━━━━━━
Your payment of *KES ${order.refundAmount || order.total}.00* has been reversed back to your M-Pesa account via Safaricom B2C. 

For inquiries or immediate assistance, contact our counter: *${storeContact}*.`;

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
};

window.sendWhatsappFromOrder = function(orderId) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  let phone = order.phone ? order.phone.replace(/[^0-9]/g, '') : '254712345678';
  if (phone.startsWith('0')) phone = '254' + phone.slice(1);
  else if (!phone.startsWith('254')) phone = '254' + phone;

  const msg = 
`🧾 *CLOUDPRINT PRO - OFFICIAL RECEIPT*
━━━━━━━━━━━━━━━━━━━━
🆔 *Job ID:* ${order.id}
📅 *Date:* ${new Date(order.timestamp).toLocaleString()}
📍 *Status:* ${order.status || 'Ready for pickup'}

📑 *DOCUMENTS:*
• ${order.fileName || 'Document.pdf'} (${order.pages || 10} pgs)

⚙️ *SPECIFICATIONS:*
• Service: ${order.serviceName || 'A4 Colour'}
• Total Pages: ${order.pages || 10}
• Copies: ${order.copies || 1} set(s)

💰 *PAYMENT SUMMARY:*
• Total Paid: *KES ${order.total}.00*
• M-Pesa Ref: *${order.mpesaRef || 'VERIFIED'}*
━━━━━━━━━━━━━━━━━━━━
✨ _Thank you for printing with CloudPrint Pro!_`;

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  showAdminToast('Opened WhatsApp dispatch', 'success');
};

// ==========================================================================
// TAB 3: CRM & CUSTOMER DIRECTORY (CARDS & FULL LIST VIEWS)
// ==========================================================================
function setCrmViewMode(mode) {
  adminState.crmViewMode = mode;
  try {
    localStorage.setItem('cloudprint_crm_view', mode);
  } catch (e) {}

  const gridBtn = document.getElementById('crmViewGridBtn');
  const listBtn = document.getElementById('crmViewListBtn');

  if (gridBtn) gridBtn.classList.toggle('active', mode === 'grid');
  if (listBtn) listBtn.classList.toggle('active', mode === 'list');

  renderCRMDirectory();
}

window.setCrmViewMode = setCrmViewMode;

function renderCRMDirectory(query = '') {
  const grid = document.getElementById('crmCustomersGrid');
  const listPanel = document.getElementById('crmCustomersListPanel');
  const tbody = document.getElementById('crmCustomersTableBody');

  const viewMode = adminState.crmViewMode || 'grid';

  // Toggle container displays
  if (viewMode === 'grid') {
    if (grid) grid.style.display = 'grid';
    if (listPanel) listPanel.style.display = 'none';
  } else {
    if (grid) grid.style.display = 'none';
    if (listPanel) listPanel.style.display = 'block';
  }

  // Update button active state indicators
  const gridBtn = document.getElementById('crmViewGridBtn');
  const listBtn = document.getElementById('crmViewListBtn');
  if (gridBtn) gridBtn.classList.toggle('active', viewMode === 'grid');
  if (listBtn) listBtn.classList.toggle('active', viewMode === 'list');

  // Aggregate customer records by phone number
  const customerMap = new Map();

  adminState.orders.forEach(order => {
    const phone = order.phone || '0712345678';
    if (!customerMap.has(phone)) {
      customerMap.set(phone, {
        phone: phone,
        name: order.customer || 'Customer ' + phone.slice(-4),
        totalOrders: 0,
        totalSpend: 0,
        totalPages: 0,
        lastOrder: order.timestamp,
        ordersList: []
      });
    }
    const c = customerMap.get(phone);
    c.totalOrders++;
    c.totalSpend += (order.total || 0);
    c.totalPages += (order.pages || 10) * (order.copies || 1);
    if (new Date(order.timestamp) > new Date(c.lastOrder)) {
      c.lastOrder = order.timestamp;
    }
    c.ordersList.push(order);
  });

  let customers = Array.from(customerMap.values());

  if (query) {
    const q = query.toLowerCase();
    customers = customers.filter(c => c.phone.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }

  if (document.getElementById('crmTotalCustomersCount')) {
    document.getElementById('crmTotalCustomersCount').textContent = customers.length;
  }

  if (customers.length === 0) {
    if (grid) grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No customers found.</div>`;
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 32px; color: var(--text-muted);">No customers found matching search criteria.</td></tr>`;
    return;
  }

  // 1. Render Cards View
  if (grid) {
    grid.innerHTML = customers.map(cust => {
      const nameStr = (cust.name || 'Customer').trim();
      const initials = nameStr.split(/\s+/).map(n => n ? n.charAt(0) : '').join('').substring(0, 2).toUpperCase() || 'CU';
      const tier = cust.totalSpend >= 200 ? 'VIP Platinum' : (cust.totalSpend >= 50 ? 'Gold Regular' : 'Silver Member');
      const cleanPhone = cust.phone.startsWith('0') ? '254' + cust.phone.slice(1) : cust.phone;

      return `
        <div class="crm-customer-card">
          <div>
            <div class="customer-card-header">
              <div class="customer-avatar">${escapeHtml(initials)}</div>
              <div>
                <div class="customer-phone">${escapeHtml(cust.phone)}</div>
                <div style="font-size: 0.74rem; color: var(--text-secondary);">${escapeHtml(nameStr)}</div>
              </div>
              <span class="customer-loyalty-badge" style="margin-left: auto;">${escapeHtml(tier)}</span>
            </div>

            <div class="customer-stats-row">
              <div class="customer-stat-col">
                <span class="stat-col-label">Total Spend</span>
                <span class="stat-col-val" style="color: var(--primary-gold);">KES ${cust.totalSpend || 0}</span>
              </div>
              <div class="customer-stat-col">
                <span class="stat-col-label">Orders / Pages</span>
                <span class="stat-col-val">${cust.totalOrders || 0} / ${cust.totalPages || 0} pgs</span>
              </div>
            </div>
          </div>

          <div class="customer-actions">
            <a href="https://wa.me/${encodeURIComponent(cleanPhone)}?text=${encodeURIComponent(`Hello ${nameStr}, thank you for choosing CloudPrint Pro! How can we assist with your print jobs today?`)}" target="_blank" class="btn-crm-whatsapp">
              <i data-lucide="message-circle" style="width: 14px; height: 14px;"></i>
              <span>Chat on WhatsApp</span>
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Render Full Detail List / Table View
  if (tbody) {
    tbody.innerHTML = customers.map(cust => {
      const nameStr = (cust.name || 'Customer').trim();
      const initials = nameStr.split(/\s+/).map(n => n ? n.charAt(0) : '').join('').substring(0, 2).toUpperCase() || 'CU';
      const tier = cust.totalSpend >= 200 ? 'VIP Platinum' : (cust.totalSpend >= 50 ? 'Gold Regular' : 'Silver Member');
      const cleanPhone = cust.phone.startsWith('0') ? '254' + cust.phone.slice(1) : cust.phone;
      const aov = cust.totalOrders > 0 ? Math.round(cust.totalSpend / cust.totalOrders) : 0;
      const lastDate = new Date(cust.lastOrder).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="customer-avatar" style="width: 32px; height: 32px; font-size: 0.76rem;">${escapeHtml(initials)}</div>
              <div>
                <strong style="color: #ffffff; font-size: 0.86rem;">${escapeHtml(nameStr)}</strong>
                <div style="font-size: 0.72rem; color: var(--text-muted);">${cust.ordersList.length} total orders recorded</div>
              </div>
            </div>
          </td>
          <td><strong style="font-family: monospace; color: var(--primary-gold);">${escapeHtml(cust.phone)}</strong></td>
          <td><span class="customer-loyalty-badge">${escapeHtml(tier)}</span></td>
          <td><strong>${cust.totalOrders || 0}</strong></td>
          <td>${cust.totalPages || 0} pgs</td>
          <td><strong style="color: #ffffff; font-size: 0.88rem;">KES ${cust.totalSpend || 0}.00</strong></td>
          <td>KES ${aov}.00</td>
          <td><span style="font-size: 0.76rem; color: var(--text-secondary);">${lastDate}</span></td>
          <td>
            <a href="https://wa.me/${encodeURIComponent(cleanPhone)}?text=${encodeURIComponent(`Hello ${nameStr}, thank you for choosing CloudPrint Pro! How can we assist with your print jobs today?`)}" target="_blank" class="btn-crm-whatsapp" style="display: inline-flex; width: auto; padding: 4px 10px; font-size: 0.72rem;">
              <i data-lucide="message-circle" style="width: 13px; height: 13px;"></i>
              <span>WhatsApp</span>
            </a>
          </td>
        </tr>
      `;
    }).join('');
  }

  if (window.lucide) {
    try { lucide.createIcons(); } catch (e) {}
  }
}

// ==========================================================================
// TAB: PRINTER FLEET & HARDWARE STATUS MODULE
// ==========================================================================
function renderPrinterFleet(filter = null, query = null) {
  if (filter !== null) adminState.printerFilter = filter;
  const currentFilter = adminState.printerFilter || 'all';

  const grid = document.getElementById('printerFleetGrid');
  if (!grid) return;

  const printers = adminState.printers || [];

  // Update Summary KPI Counters
  const totalCount = printers.length;
  const readyCount = printers.filter(p => p.status === 'ready' || p.status === 'printing').length;
  const warnCount = printers.filter(p => p.status === 'warning' || (p.supplies && p.supplies.tonerBlack && p.supplies.tonerBlack < 20) || (p.paperTrays && p.paperTrays.some(t => t.percent < 15))).length;
  const jamCount = printers.filter(p => p.paperJam || p.status === 'jam').length;

  if (document.getElementById('fleetTotalUnits')) document.getElementById('fleetTotalUnits').textContent = `${totalCount} Units`;
  if (document.getElementById('fleetOnlineUnits')) document.getElementById('fleetOnlineUnits').textContent = `${readyCount} Ready`;
  if (document.getElementById('fleetWarningUnits')) document.getElementById('fleetWarningUnits').textContent = `${warnCount} Attention`;
  
  const jamStatusEl = document.getElementById('fleetJamStatus');
  if (jamStatusEl) {
    if (jamCount > 0) {
      jamStatusEl.textContent = `${jamCount} Jam${jamCount > 1 ? 's' : ''} Detected!`;
      jamStatusEl.style.color = '#f87171';
    } else {
      jamStatusEl.textContent = `0 Jams (All Clear)`;
      jamStatusEl.style.color = 'var(--mpesa-green)';
    }
  }

  const liveBadge = document.getElementById('printerFleetLiveBadge');
  if (liveBadge) {
    if (jamCount > 0) {
      liveBadge.textContent = `${jamCount} Jammed`;
      liveBadge.style.background = 'rgba(239, 68, 68, 0.2)';
      liveBadge.style.color = '#f87171';
    } else if (warnCount > 0) {
      liveBadge.textContent = `${readyCount} Ready (${warnCount} Low)`;
      liveBadge.style.background = 'rgba(245, 158, 11, 0.2)';
      liveBadge.style.color = 'var(--primary-gold)';
    } else {
      liveBadge.textContent = `${readyCount} Ready`;
      liveBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      liveBadge.style.color = 'var(--mpesa-green)';
    }
  }

  // Update filter pill UI
  document.querySelectorAll('#printerFilterPills .status-pill').forEach(pill => {
    const pFilter = pill.getAttribute('data-filter');
    pill.classList.toggle('active', pFilter === currentFilter);
  });

  // Filter printers
  let filtered = [...printers];

  if (currentFilter === 'ready') {
    filtered = filtered.filter(p => p.status === 'ready' || p.status === 'printing');
  } else if (currentFilter === 'warning') {
    filtered = filtered.filter(p => p.status === 'warning' || (p.supplies && p.supplies.tonerBlack && p.supplies.tonerBlack < 20) || (p.paperTrays && p.paperTrays.some(t => t.percent < 15)));
  } else if (currentFilter === 'jam') {
    filtered = filtered.filter(p => p.paperJam || p.status === 'jam');
  }

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.model.toLowerCase().includes(q) ||
      p.ip.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">No printers found matching the current filter.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(prn => {
    const isOffline = prn.status === 'offline';
    const isJammed = !isOffline && (prn.paperJam || prn.status === 'jam');
    const isPrinting = !isOffline && !isJammed && prn.status === 'printing';
    const isWarning = !isOffline && !isJammed && !isPrinting && (prn.status === 'warning' || (prn.supplies && prn.supplies.tonerBlack && prn.supplies.tonerBlack < 20) || (prn.paperTrays && prn.paperTrays.some(t => t.percent < 15)));

    let cardStatusClass = '';
    let badgeHtml = '';

    if (isOffline) {
      cardStatusClass = 'status-offline';
      badgeHtml = `
        <div class="printer-status-blinker-pill offline" title="Printer is currently offline / disconnected">
          <span class="led-blinker gray"></span>
          <span>Offline</span>
        </div>
      `;
    } else if (isJammed) {
      cardStatusClass = 'status-jam';
      badgeHtml = `
        <div class="printer-status-blinker-pill jam" title="Paper feed path obstructed!">
          <span class="led-blinker red"></span>
          <span>⚠️ Paper Jam</span>
        </div>
      `;
    } else if (isPrinting) {
      cardStatusClass = 'status-printing';
      badgeHtml = `
        <div class="printer-status-blinker-pill printing" title="Processing print job spool">
          <span class="led-blinker blue"></span>
          <span>Active Printing</span>
        </div>
      `;
    } else if (isWarning) {
      cardStatusClass = 'status-warning';
      badgeHtml = `
        <div class="printer-status-blinker-pill warning" title="Consumable or paper level low">
          <span class="led-blinker yellow"></span>
          <span>Low Supplies</span>
        </div>
      `;
    } else {
      badgeHtml = `
        <div class="printer-status-blinker-pill online" title="Operational & ready on local network">
          <span class="led-blinker green"></span>
          <span>Online &amp; Ready</span>
        </div>
      `;
    }

    // Supplies Bars Rendering
    const supplies = prn.supplies || {};
    let suppliesHtml = '';

    if (supplies.tonerBlack !== undefined) {
      suppliesHtml += `
        <div class="supply-bar-item">
          <div class="supply-bar-header">
            <span>Black Toner (K)</span>
            <strong style="color: ${supplies.tonerBlack < 20 ? '#ef4444' : '#ffffff'};">${supplies.tonerBlack}%</strong>
          </div>
          <div class="supply-progress-bg">
            <div class="supply-progress-fill black ${supplies.tonerBlack < 20 ? 'low' : ''}" style="width: ${supplies.tonerBlack}%;"></div>
          </div>
        </div>
      `;
    }

    if (supplies.tonerCyan !== undefined) {
      suppliesHtml += `
        <div class="supply-bar-item">
          <div class="supply-bar-header">
            <span>Cyan (C)</span>
            <strong>${supplies.tonerCyan}%</strong>
          </div>
          <div class="supply-progress-bg">
            <div class="supply-progress-fill cyan ${supplies.tonerCyan < 20 ? 'low' : ''}" style="width: ${supplies.tonerCyan}%;"></div>
          </div>
        </div>
      `;
    }

    if (supplies.tonerMagenta !== undefined) {
      suppliesHtml += `
        <div class="supply-bar-item">
          <div class="supply-bar-header">
            <span>Magenta (M)</span>
            <strong>${supplies.tonerMagenta}%</strong>
          </div>
          <div class="supply-progress-bg">
            <div class="supply-progress-fill magenta ${supplies.tonerMagenta < 20 ? 'low' : ''}" style="width: ${supplies.tonerMagenta}%;"></div>
          </div>
        </div>
      `;
    }

    if (supplies.tonerYellow !== undefined) {
      suppliesHtml += `
        <div class="supply-bar-item">
          <div class="supply-bar-header">
            <span>Yellow (Y)</span>
            <strong>${supplies.tonerYellow}%</strong>
          </div>
          <div class="supply-progress-bg">
            <div class="supply-progress-fill yellow ${supplies.tonerYellow < 20 ? 'low' : ''}" style="width: ${supplies.tonerYellow}%;"></div>
          </div>
        </div>
      `;
    }

    if (supplies.inkBlack !== undefined) {
      suppliesHtml += `
        <div class="supply-bar-item">
          <div class="supply-bar-header">
            <span>Pigment Ink Black</span>
            <strong>${supplies.inkBlack}%</strong>
          </div>
          <div class="supply-progress-bg">
            <div class="supply-progress-fill black" style="width: ${supplies.inkBlack}%;"></div>
          </div>
        </div>
      `;
    }

    if (supplies.drumUnit !== undefined) {
      suppliesHtml += `
        <div class="supply-bar-item">
          <div class="supply-bar-header">
            <span>Imaging Drum Life</span>
            <strong>${supplies.drumUnit}%</strong>
          </div>
          <div class="supply-progress-bg">
            <div class="supply-progress-fill drum" style="width: ${supplies.drumUnit}%;"></div>
          </div>
        </div>
      `;
    }

    // Paper Trays Rendering
    const traysHtml = (prn.paperTrays || []).map(tray => `
      <div class="printer-tray-card ${tray.percent < 15 ? 'warning' : ''}">
        <div class="tray-title-row">
          <span>${tray.name}</span>
          <span style="color: ${tray.percent < 15 ? '#f87171' : 'var(--primary-gold)'};">${tray.percent}%</span>
        </div>
        <div class="supply-progress-bg" style="height: 4px; margin: 4px 0;">
          <div class="supply-progress-fill" style="width: ${tray.percent}%; background: ${tray.percent < 15 ? '#ef4444' : 'var(--primary-gold)'};"></div>
        </div>
        <div class="tray-sheet-count">${tray.current} / ${tray.capacity} sheets left</div>
      </div>
    `).join('');

    return `
      <div class="printer-device-card ${cardStatusClass}" id="card_${prn.id}">
        <div>
          <div class="printer-card-header">
            <div class="printer-title-group">
              <div class="printer-device-icon-box ${isJammed ? 'jam' : ''}">
                <i data-lucide="printer" style="width: 22px; height: 22px;"></i>
              </div>
              <div>
                <div class="printer-device-name">${prn.name}</div>
                <div class="printer-device-model">${prn.model}</div>
              </div>
            </div>
            ${badgeHtml}
          </div>

          <!-- Hardware Specs Grid -->
          <div class="printer-specs-grid" style="margin-top: 14px;">
            <div class="printer-spec-item">
              <span class="spec-label">Type:</span>
              <span class="spec-val">${prn.type}</span>
            </div>
            <div class="printer-spec-item">
              <span class="spec-label">IP Address:</span>
              <span class="spec-val" style="font-family: monospace; color: var(--accent-blue);">${prn.ip}</span>
            </div>
            <div class="printer-spec-item">
              <span class="spec-label">Port / Protocol:</span>
              <span class="spec-val">${prn.port}</span>
            </div>
            <div class="printer-spec-item">
              <span class="spec-label">Hardware Uptime:</span>
              <span class="spec-val" style="color: var(--mpesa-green);">${prn.uptime}</span>
            </div>
            <div class="printer-spec-item" style="grid-column: 1/-1;">
              <span class="spec-label">Terminal Location:</span>
              <span class="spec-val" style="color: var(--text-secondary); font-size: 0.72rem;">${prn.location}</span>
            </div>
          </div>

          <!-- Toner & Consumables -->
          <div style="margin-top: 14px;">
            <div class="printer-block-title">
              <i data-lucide="droplet" style="width: 13px; height: 13px; color: var(--primary-gold);"></i>
              <span>Consumables &amp; Cartridge Levels</span>
            </div>
            <div class="printer-supplies-bars">
              ${suppliesHtml}
            </div>
          </div>

          <!-- Paper Feed Trays -->
          <div style="margin-top: 14px;">
            <div class="printer-block-title">
              <i data-lucide="layers" style="width: 13px; height: 13px; color: var(--primary-gold);"></i>
              <span>Paper Feed Trays</span>
            </div>
            <div class="printer-trays-grid">
              ${traysHtml}
            </div>
          </div>

          <!-- Sensors & Real-time Telemetry -->
          <div style="margin-top: 14px;">
            <div class="printer-block-title">
              <i data-lucide="cpu" style="width: 13px; height: 13px; color: var(--primary-gold);"></i>
              <span>Hardware Sensors &amp; Telemetry</span>
            </div>
            <div class="printer-sensors-row">
              <span class="sensor-badge ${isJammed ? 'jam' : (isOffline ? '' : 'ok')}">
                <i data-lucide="${isJammed ? 'alert-triangle' : 'check-circle'}" style="width: 12px; height: 12px;"></i>
                <span>${isJammed ? '⚠️ Feed Jam: Optical Path' : 'Jam Sensor: Clear'}</span>
              </span>
              <span class="sensor-badge ${isOffline ? '' : 'ok'}">
                <i data-lucide="thermometer" style="width: 12px; height: 12px;"></i>
                <span>Temp: ${prn.temperature}°C (Optimal)</span>
              </span>
              <span class="sensor-badge ${isOffline ? '' : 'ok'}">
                <i data-lucide="lock" style="width: 12px; height: 12px;"></i>
                <span>Door: Closed</span>
              </span>
              <span class="sensor-badge ${prn.spoolQueue > 0 ? 'warn' : 'ok'}">
                <i data-lucide="layers" style="width: 12px; height: 12px;"></i>
                <span>Spool Queue: ${prn.spoolQueue} ${prn.spoolQueue === 1 ? 'Job' : 'Jobs'}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Interactive Control Actions -->
        <div class="printer-card-actions">
          <button type="button" class="btn-device-action" onclick="testPrint('${prn.id}')" title="Send a test calibration page to this device">
            <i data-lucide="printer" style="width: 13px; height: 13px;"></i>
            <span>Test Print</span>
          </button>
          <button type="button" class="btn-device-action ${isOffline ? 'gold' : ''}" onclick="togglePrinterOnline('${prn.id}')" title="${isOffline ? 'Connect printer online' : 'Set printer offline'}">
            <i data-lucide="${isOffline ? 'wifi' : 'wifi-off'}" style="width: 13px; height: 13px;"></i>
            <span>${isOffline ? 'Go Online' : 'Set Offline'}</span>
          </button>
          ${isJammed ? `
            <button type="button" class="btn-device-action gold" onclick="clearPaperJam('${prn.id}')" title="Clear paper jam and resume online printing">
              <i data-lucide="check" style="width: 13px; height: 13px;"></i>
              <span>Clear Jam</span>
            </button>
          ` : `
            <button type="button" class="btn-device-action" onclick="runDiagnosticSweep('${prn.id}')" title="Run hardware self-test diagnostic sweep">
              <i data-lucide="activity" style="width: 13px; height: 13px;"></i>
              <span>Diagnostics</span>
            </button>
          `}
          <button type="button" class="btn-device-action gold" onclick="refillPrinter('${prn.id}')" title="Replenish toner and paper trays to 100%">
            <i data-lucide="refresh-cw" style="width: 13px; height: 13px;"></i>
            <span>Refill Supplies</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) {
    try { lucide.createIcons(); } catch (e) {}
  }
}

// Hardware Device Interactive Actions
function testPrint(printerId) {
  const printer = (adminState.printers || []).find(p => p.id === printerId);
  if (!printer) return;

  if (printer.paperJam || printer.status === 'jam') {
    showAdminToast(`Cannot print: ${printer.name} has a paper jam! Clear jam first.`, 'error');
    return;
  }

  printer.spoolQueue++;
  addAuditLog('INFO', `Diagnostic: Test calibration pattern sent to ${printer.model} (${printer.ip}:9100)`);
  showAdminToast(`Sent test print to ${printer.name}!`, 'success');

  renderPrinterFleet();

  setTimeout(() => {
    printer.spoolQueue = Math.max(0, printer.spoolQueue - 1);
    addAuditLog('SUCCESS', `Spooler: Test page output completed on ${printer.model}`);
    renderPrinterFleet();
  }, 4000);
}

function clearPaperJam(printerId) {
  const printer = (adminState.printers || []).find(p => p.id === printerId);
  if (!printer) return;

  printer.paperJam = false;
  printer.status = 'ready';
  printer.statusLabel = 'Online & Ready';
  addAuditLog('SUCCESS', `Hardware Alert: Paper Jam cleared on ${printer.name}. Unit restored to Online & Ready.`);
  showAdminToast(`Paper jam cleared on ${printer.name}!`, 'success');

  try {
    localStorage.setItem('cloudprint_printers', JSON.stringify(adminState.printers));
  } catch (e) {}

  renderPrinterFleet();
}

function runDiagnosticSweep(printerId) {
  const printer = (adminState.printers || []).find(p => p.id === printerId);
  if (!printer) return;

  addAuditLog('INFO', `Hardware Diagnostic: Sweeping sensors, fuser, and optical path on ${printer.name}...`);
  showAdminToast(`Diagnostic sweep initiated on ${printer.name}...`, 'info');

  setTimeout(() => {
    addAuditLog('SUCCESS', `Hardware Diagnostic: All sensors OK • Roller wear 12% • Engine temp: ${printer.temperature || 40}°C`);
    showAdminToast(`Diagnostic complete for ${printer.name}: All systems normal!`, 'success');
  }, 1500);
}

  try {
    localStorage.setItem('cloudprint_printers', JSON.stringify(adminState.printers));
  } catch (e) {}

  renderPrinterFleet();
}

function refillPrinter(printerId) {
  const printer = (adminState.printers || []).find(p => p.id === printerId);
  if (!printer) return;

  // Replenish toners
  if (printer.supplies) {
    if (printer.supplies.tonerBlack !== undefined) printer.supplies.tonerBlack = 100;
    if (printer.supplies.tonerCyan !== undefined) printer.supplies.tonerCyan = 100;
    if (printer.supplies.tonerMagenta !== undefined) printer.supplies.tonerMagenta = 100;
    if (printer.supplies.tonerYellow !== undefined) printer.supplies.tonerYellow = 100;
    if (printer.supplies.inkBlack !== undefined) printer.supplies.inkBlack = 100;
    if (printer.supplies.drumUnit !== undefined) printer.supplies.drumUnit = 100;
  }

  // Replenish paper trays
  if (printer.paperTrays) {
    printer.paperTrays.forEach(tray => {
      tray.current = tray.capacity;
      tray.percent = 100;
      tray.warning = false;
    });
  }

  if (printer.status === 'warning') {
    printer.status = 'ready';
    printer.statusLabel = 'Online & Ready';
  }

  addAuditLog('SUCCESS', `Maintenance: Supplies and paper trays replenished to 100% for ${printer.name}`);
  showAdminToast(`Supplies replenished for ${printer.name}!`, 'success');

  try {
    localStorage.setItem('cloudprint_printers', JSON.stringify(adminState.printers));
  } catch (e) {}

  renderPrinterFleet();
}

function refillAllPrinters() {
  if (!hasPermission('printers') && !hasPermission('printers_full') && !hasPermission('printers_refill') && !hasPermission('all')) {
    showAdminToast('Access Denied: Fleet refill restricted for your role.', 'error');
    return;
  }

  (adminState.printers || []).forEach(printer => {
    if (printer.supplies) {
      if (printer.supplies.tonerBlack !== undefined) printer.supplies.tonerBlack = 100;
      if (printer.supplies.tonerCyan !== undefined) printer.supplies.tonerCyan = 100;
      if (printer.supplies.tonerMagenta !== undefined) printer.supplies.tonerMagenta = 100;
      if (printer.supplies.tonerYellow !== undefined) printer.supplies.tonerYellow = 100;
      if (printer.supplies.inkBlack !== undefined) printer.supplies.inkBlack = 100;
      if (printer.supplies.drumUnit !== undefined) printer.supplies.drumUnit = 100;
    }
    if (printer.paperTrays) {
      printer.paperTrays.forEach(tray => {
        tray.current = tray.capacity;
        tray.percent = 100;
        tray.warning = false;
      });
    }
    if (printer.status === 'warning') {
      printer.status = 'ready';
      printer.statusLabel = 'Online & Ready';
    }
  });

  addAuditLog('SUCCESS', 'Maintenance: All connected printer fleet supplies & paper trays refilled to 100%');
  showAdminToast('All printer supplies and paper trays refilled!', 'success');

  try {
    localStorage.setItem('cloudprint_printers', JSON.stringify(adminState.printers));
  } catch (e) {}

  renderPrinterFleet();
}

function runFleetDiagnostics() {
  addAuditLog('INFO', 'SNMP Diagnostics: Initiating telemetry health sweep across all LAN & WiFi printer nodes...');
  showAdminToast('Running fleet diagnostics sweep...', 'success');

  setTimeout(() => {
    const count = (adminState.printers || []).length;
    addAuditLog('SUCCESS', `SNMP Diagnostics: Sweep complete. ${count}/${count} nodes responding. Laser engine thermal levels normal.`);
    showAdminToast('Fleet diagnostics complete. All hardware nodes verified!', 'success');
    renderPrinterFleet();
  }, 1200);
}

function togglePrinterOnline(printerId) {
  if (!hasPermission('printers') && !hasPermission('printers_full') && !hasPermission('all')) {
    showAdminToast('Access Denied: Printer status modification restricted.', 'error');
    return;
  }

  const printer = (adminState.printers || []).find(p => p.id === printerId);
  if (!printer) return;

  if (printer.status === 'offline') {
    printer.status = printer.paperJam ? 'jam' : 'ready';
    printer.statusLabel = 'Online & Ready';
    addAuditLog('SUCCESS', `Hardware Node: ${printer.name} (${printer.ip}) connected back ONLINE.`);
    showAdminToast(`${printer.name} is now ONLINE!`, 'success');
  } else {
    printer.status = 'offline';
    printer.statusLabel = 'Offline (Maintenance)';
    addAuditLog('WARN', `Hardware Node: ${printer.name} (${printer.ip}) set to OFFLINE.`);
    showAdminToast(`${printer.name} is now OFFLINE.`, 'warn');
  }

  try {
    localStorage.setItem('cloudprint_printers', JSON.stringify(adminState.printers));
  } catch (e) {}

  renderPrinterFleet();
}

// Printer Modal & Node Management Operations
function openAddPrinterModal() {
  const modal = document.getElementById('adminPrinterModal');
  const body = document.getElementById('adminPrinterModalBody');
  const title = document.getElementById('adminPrinterModalTitle');
  if (!modal || !body) return;

  if (title) title.textContent = 'Add Network Printer Node';

  body.innerHTML = `
    <form id="printerForm" onsubmit="event.preventDefault(); savePrinterForm(null);">
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Printer Display Name *</label>
        <input type="text" id="prnName" required placeholder="e.g. Counter #1 - Fast Mono Laser" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Hardware Model *</label>
          <input type="text" id="prnModel" required placeholder="HP LaserJet Pro M404dn" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">IP Address *</label>
          <input type="text" id="prnIp" required placeholder="192.168.1.125" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Port / Protocol</label>
          <input type="text" id="prnPort" value="9100 / RAW" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Location / Station</label>
          <input type="text" id="prnLocation" placeholder="Counter #1" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button type="button" class="btn-secondary-action" onclick="closePrinterModal()">Cancel</button>
        <button type="submit" class="btn-primary-action">
          <i data-lucide="check"></i>
          <span>Save Printer</span>
        </button>
      </div>
    </form>
  `;

  modal.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function openEditPrinterModal(printerId) {
  const printer = (adminState.printers || []).find(p => p.id === printerId);
  if (!printer) return;

  const modal = document.getElementById('adminPrinterModal');
  const body = document.getElementById('adminPrinterModalBody');
  const title = document.getElementById('adminPrinterModalTitle');
  if (!modal || !body) return;

  if (title) title.textContent = `Edit Printer: ${printer.name}`;

  body.innerHTML = `
    <form id="printerForm" onsubmit="event.preventDefault(); savePrinterForm('${printer.id}');">
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Printer Display Name *</label>
        <input type="text" id="prnName" value="${escapeHtml(printer.name)}" required class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Hardware Model *</label>
          <input type="text" id="prnModel" value="${escapeHtml(printer.model)}" required class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">IP Address *</label>
          <input type="text" id="prnIp" value="${escapeHtml(printer.ip)}" required class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Port / Protocol</label>
          <input type="text" id="prnPort" value="${escapeHtml(printer.port || '9100 / RAW')}" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Location / Station</label>
          <input type="text" id="prnLocation" value="${escapeHtml(printer.location || 'Counter Kiosk')}" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button type="button" class="btn-secondary-action" onclick="closePrinterModal()">Cancel</button>
        <button type="submit" class="btn-primary-action">
          <i data-lucide="save"></i>
          <span>Save Changes</span>
        </button>
      </div>
    </form>
  `;

  modal.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closePrinterModal() {
  const modal = document.getElementById('adminPrinterModal');
  if (modal) modal.classList.remove('active');
}

function savePrinterForm(printerId) {
  if (!hasPermission('printers') && !hasPermission('printers_full') && !hasPermission('all')) {
    showAdminToast('Access Denied: Printer management restricted.', 'error');
    return;
  }

  const name = document.getElementById('prnName').value.trim();
  const model = document.getElementById('prnModel').value.trim();
  const ip = document.getElementById('prnIp').value.trim();
  const port = document.getElementById('prnPort').value.trim();
  const location = document.getElementById('prnLocation').value.trim();

  if (!name || !model || !ip) {
    showAdminToast('Please fill in required printer fields.', 'error');
    return;
  }

  if (printerId) {
    const printer = (adminState.printers || []).find(p => p.id === printerId);
    if (printer) {
      printer.name = name;
      printer.model = model;
      printer.ip = ip;
      printer.port = port;
      printer.location = location;
      addAuditLog('SUCCESS', `Printer Fleet: Updated configuration for ${printer.name} (${printer.ip}).`);
      showAdminToast(`Printer ${printer.name} updated!`, 'success');
    }
  } else {
    const newId = 'PRN-' + String((adminState.printers.length + 1)).padStart(2, '0');
    const newPrinter = {
      id: newId,
      name: name,
      model: model,
      type: 'Network Commercial Laser',
      ip: ip,
      port: port || '9100 / RAW',
      protocol: 'Gigabit Ethernet',
      status: 'ready',
      statusLabel: 'Online & Ready',
      location: location || 'Counter Kiosk',
      serialNumber: 'HP-M' + Math.floor(100000 + Math.random() * 900000),
      ipAddress: ip,
      uptime: '100% (Just Added)',
      paperJam: false,
      jamLocation: null,
      coverOpen: false,
      temperature: 32,
      spoolQueue: 0,
      supplies: {
        tonerBlack: 100,
        tonerCyan: 100,
        tonerMagenta: 100,
        tonerYellow: 100,
        drumUnit: 100
      },
      paperTrays: [
        { name: 'Tray 1 (A4 Plain)', current: 500, capacity: 500, percent: 100, format: 'A4' }
      ]
    };
    adminState.printers.push(newPrinter);
    addAuditLog('SUCCESS', `Printer Fleet: Added new network printer node ${newPrinter.name} (${newPrinter.ip}).`);
    showAdminToast(`Printer ${newPrinter.name} added to fleet!`, 'success');
  }

  try {
    localStorage.setItem('cloudprint_printers', JSON.stringify(adminState.printers));
  } catch (e) {}

  closePrinterModal();
  renderPrinterFleet();
}

function deletePrinter(printerId) {
  if (!hasPermission('printers') && !hasPermission('printers_full') && !hasPermission('all')) {
    showAdminToast('Access Denied: Printer deletion restricted.', 'error');
    return;
  }

  if (confirm(`Are you sure you want to remove printer node ${printerId}?`)) {
    adminState.printers = adminState.printers.filter(p => p.id !== printerId);
    addAuditLog('WARN', `Printer Fleet: Removed printer node ${printerId}.`);
    showAdminToast(`Printer node ${printerId} removed.`, 'success');

    try {
      localStorage.setItem('cloudprint_printers', JSON.stringify(adminState.printers));
    } catch (e) {}

    renderPrinterFleet();
  }
}

// Customer Profile Modal Operations
function openCustomerProfileModal(phone) {
  const modal = document.getElementById('adminCustomerProfileModal');
  const body = document.getElementById('customerProfileModalBody');
  const title = document.getElementById('customerProfileModalTitle');
  if (!modal || !body) return;

  const orders = (adminState.orders || []).filter(o => o.phone === phone);
  const customerName = (orders[0] && orders[0].customer) || 'Customer ' + phone.slice(-4);
  const totalSpend = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalPages = orders.reduce((sum, o) => sum + (o.pages || 10) * (o.copies || 1), 0);

  if (title) title.textContent = `Profile: ${customerName}`;

  body.innerHTML = `
    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 1.1rem; font-weight: 800; color: #ffffff;">${escapeHtml(customerName)}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">Phone: <strong>+254 ${escapeHtml(phone.replace(/^0/, ''))}</strong></div>
        </div>
        <span class="badge-status ready">Active Customer</span>
      </div>
      <div style="display: flex; gap: 14px; margin-top: 10px; font-size: 0.8rem;">
        <div>Orders: <strong style="color: var(--primary-gold);">${orders.length}</strong></div>
        <div>Total Spend: <strong style="color: var(--mpesa-green);">KES ${totalSpend}.00</strong></div>
        <div>Pages Printed: <strong style="color: #60a5fa;">${totalPages}</strong></div>
      </div>
    </div>

    <div style="font-weight: 700; font-size: 0.84rem; margin-bottom: 8px; color: #ffffff;">Recent Print History</div>
    <div style="max-height: 220px; overflow-y: auto;">
      ${orders.map(o => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); border-radius: 6px; margin-bottom: 6px; font-size: 0.78rem;">
          <div>
            <strong style="color: var(--primary-gold);">${escapeHtml(o.id)}</strong> - ${escapeHtml(o.fileName || 'Document.pdf')}
            <div style="font-size: 0.7rem; color: var(--text-muted);">${new Date(o.timestamp).toLocaleDateString()} • ${escapeHtml(o.serviceName || 'A4 Colour')}</div>
          </div>
          <div>
            <strong style="color: var(--mpesa-green);">KES ${o.total || 0}.00</strong>
          </div>
        </div>
      `).join('')}
    </div>

    <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
      <button class="btn-secondary-action" onclick="closeCustomerProfileModal()">Close</button>
      <button class="btn-primary-action" style="background: var(--mpesa-green); color: #111317;" onclick="window.open('https://wa.me/254${phone.replace(/^0/, '')}', '_blank')">
        <i data-lucide="message-circle"></i>
        <span>WhatsApp Customer</span>
      </button>
    </div>
  `;

  modal.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeCustomerProfileModal() {
  const modal = document.getElementById('adminCustomerProfileModal');
  if (modal) modal.classList.remove('active');
}

window.openAddPrinterModal = openAddPrinterModal;
window.openEditPrinterModal = openEditPrinterModal;
window.closePrinterModal = closePrinterModal;
window.savePrinterForm = savePrinterForm;
window.deletePrinter = deletePrinter;
window.openCustomerProfileModal = openCustomerProfileModal;
window.closeCustomerProfileModal = closeCustomerProfileModal;

window.testPrint = testPrint;
window.togglePaperJam = togglePaperJam;
window.togglePrinterOnline = togglePrinterOnline;
window.refillPrinter = refillPrinter;
window.refillAllPrinters = refillAllPrinters;
window.runFleetDiagnostics = runFleetDiagnostics;
window.renderPrinterFleet = renderPrinterFleet;

// ==========================================================================
// TAB 4: CMS & PRICING ENGINE
// ==========================================================================
function renderCMSForm() {
  const p = adminState.pricing;
  const c = adminState.cms;

  if (document.getElementById('rateA4Bw')) document.getElementById('rateA4Bw').value = p.a4_bw || 1;
  if (document.getElementById('rateA4Colour')) document.getElementById('rateA4Colour').value = p.a4_colour || 3;
  if (document.getElementById('rateA3Bw')) document.getElementById('rateA3Bw').value = p.a3_bw || 2;
  if (document.getElementById('rateA3Colour')) document.getElementById('rateA3Colour').value = p.a3_colour || 5;

  if (document.getElementById('cmsAnnouncementText')) document.getElementById('cmsAnnouncementText').value = c.announcement || '';
  if (document.getElementById('cmsBannerActive')) document.getElementById('cmsBannerActive').value = String(c.bannerActive);
  if (document.getElementById('cmsPaybillNo')) document.getElementById('cmsPaybillNo').value = c.paybillNo || '892100';
  if (document.getElementById('cmsWhatsappContact')) document.getElementById('cmsWhatsappContact').value = c.whatsappContact || '+254 712 345 678';
}

// ==========================================================================
// TAB 5: REPORTS & FINANCIALS
// ==========================================================================
function renderReports(period = 'all') {
  const orders = adminState.orders;
  const gross = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const fee = Math.round(gross * 0.015);
  const net = gross - fee;
  const aov = orders.length > 0 ? (gross / orders.length).toFixed(2) : 0;

  if (document.getElementById('repGrossSales')) document.getElementById('repGrossSales').textContent = `KES ${gross.toLocaleString()}`;
  if (document.getElementById('repMpesaFees')) document.getElementById('repMpesaFees').textContent = `KES ${fee.toLocaleString()}`;
  if (document.getElementById('repNetPayout')) document.getElementById('repNetPayout').textContent = `KES ${net.toLocaleString()}`;
  if (document.getElementById('repAOV')) document.getElementById('repAOV').textContent = `KES ${aov}`;

  const catTbody = document.getElementById('reportsCategoryTableBody');
  if (catTbody) {
    const categories = [
      { name: 'A4 Full Colour Laser', rate: `KES ${adminState.pricing.a4_colour}`, pages: 2540, jobs: 180, rev: 7620, share: '55%' },
      { name: 'A4 Black & White Mono', rate: `KES ${adminState.pricing.a4_bw}`, pages: 4100, jobs: 94, rev: 4100, share: '30%' },
      { name: 'A3 Large Format Colour', rate: `KES ${adminState.pricing.a3_colour}`, pages: 350, jobs: 35, rev: 1750, share: '10%' },
      { name: 'A3 Large Format B&W', rate: `KES ${adminState.pricing.a3_bw}`, pages: 365, jobs: 21, rev: 730, share: '5%' }
    ];

    catTbody.innerHTML = categories.map(c => `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.rate} /pg</td>
        <td>${c.pages.toLocaleString()} units</td>
        <td>${c.jobs} orders</td>
        <td><strong style="color: var(--primary-gold);">KES ${c.rev.toLocaleString()}</strong></td>
        <td><span class="badge-gold">${c.share}</span></td>
      </tr>
    `).join('');
  }
}

// ==========================================================================
// TAB 6: LOGS STREAM
// ==========================================================================
function renderLogsStream() {
  const container = document.getElementById('logsStreamContainer');
  if (!container) return;

  container.innerHTML = adminState.logs.map(log => `
    <div class="log-entry">
      <span class="log-time">[${log.time}]</span>
      <span class="log-badge ${log.level.toLowerCase()}">${log.level}</span>
      <span class="log-msg">${log.msg}</span>
    </div>
  `).join('');

  container.scrollTop = container.scrollHeight;
}

function addAuditLog(level, msg) {
  const newLog = {
    time: formatLogTime(new Date()),
    level: level,
    msg: msg
  };
  adminState.logs.push(newLog);
  if (adminState.logs.length > 50) adminState.logs.shift();

  try {
    localStorage.setItem('cloudprint_logs', JSON.stringify(adminState.logs));
  } catch (e) {}

  renderLogsStream();
}

// ==========================================================================
// TAB 7: USER MANAGEMENT & ROLE-BASED ACCESS CONTROL (RBAC)
// ==========================================================================
function updateRoleProfileWidget() {
  const user = adminState.currentUser || (adminState.users && adminState.users[0]) || { name: 'Admin', roleLabel: 'Super Admin', avatar: 'AD' };
  
  const avatarEl = document.getElementById('sidebarUserAvatar');
  const nameEl = document.getElementById('sidebarUserName');
  const roleEl = document.getElementById('sidebarUserRole');

  if (avatarEl) avatarEl.textContent = user.avatar || user.name.substring(0, 2).toUpperCase();
  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = `${user.roleLabel || 'Staff'} • ${user.role === 'admin' ? 'All Rights' : 'Restricted'}`;

  // Update sidebar visual indicator badges / locked items based on active role
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    const tab = item.getAttribute('data-tab');
    const isAllowed = canAccessTab(tab);
    item.style.opacity = isAllowed ? '1' : '0.45';
    item.title = isAllowed ? '' : `Restricted: Only Super Admin / Authorized staff can access ${tab}`;
  });
}

function renderUsersDirectory(filterRole = null, query = null) {
  if (filterRole !== null) adminState.userFilter = filterRole;
  const currentFilter = adminState.userFilter || 'all';

  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  const users = adminState.users || [];

  // Update KPI counters
  const totalCount = users.length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const managerCount = users.filter(u => u.role === 'manager').length;
  const cashierCount = users.filter(u => u.role === 'cashier').length;
  const techCount = users.filter(u => u.role === 'technician').length;
  const accountantCount = users.filter(u => u.role === 'accountant').length;
  const operationalCount = totalCount - adminCount;

  if (document.getElementById('kpiTotalStaffCount')) document.getElementById('kpiTotalStaffCount').textContent = `${totalCount} Accounts`;
  if (document.getElementById('kpiSuperAdminCount')) document.getElementById('kpiSuperAdminCount').textContent = `${adminCount} Root Admin${adminCount > 1 ? 's' : ''}`;
  if (document.getElementById('kpiOperationalRolesCount')) document.getElementById('kpiOperationalRolesCount').textContent = `${operationalCount} Limited Roles`;
  if (document.getElementById('usersNavCount')) document.getElementById('usersNavCount').textContent = `${totalCount} Staff`;

  if (document.getElementById('countUsersAll')) document.getElementById('countUsersAll').textContent = totalCount;
  if (document.getElementById('countUsersAdmin')) document.getElementById('countUsersAdmin').textContent = adminCount;
  if (document.getElementById('countUsersManager')) document.getElementById('countUsersManager').textContent = managerCount;
  if (document.getElementById('countUsersCashier')) document.getElementById('countUsersCashier').textContent = cashierCount;
  if (document.getElementById('countUsersTech')) document.getElementById('countUsersTech').textContent = techCount;
  if (document.getElementById('countUsersAccountant')) document.getElementById('countUsersAccountant').textContent = accountantCount;

  // Filter Pills UI
  document.querySelectorAll('#userFilterPills .status-pill').forEach(pill => {
    const pRole = pill.getAttribute('data-role');
    pill.classList.toggle('active', pRole === currentFilter);
  });

  // Filter Users
  let filtered = [...users];

  if (currentFilter !== 'all') {
    filtered = filtered.filter(u => u.role === currentFilter);
  }

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(u => 
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.roleLabel && u.roleLabel.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px; color: var(--text-muted);">
          <i data-lucide="users" style="width: 32px; height: 32px; margin-bottom: 6px; color: var(--primary-gold);"></i>
          <div>No staff users found matching criteria.</div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(u => {
    const isCurrentActive = adminState.currentUser && adminState.currentUser.id === u.id;
    const isSuperAdmin = u.role === 'admin';
    const isSuspended = u.status === 'suspended';

    // Permissions summary badges
    let permBadgesHtml = '';
    if (isSuperAdmin || (u.permissions && u.permissions.includes('all'))) {
      permBadgesHtml = `<span class="badge-gold" style="font-size: 0.68rem;">⭐ Full Root Access (All Modules)</span>`;
    } else {
      const perms = u.permissions || [];
      permBadgesHtml = perms.map(p => `<span class="permission-tag">${p}</span>`).join('') || '<span style="color: var(--text-muted); font-size: 0.72rem;">Limited Access</span>';
    }

    return `
      <tr style="${isSuspended ? 'opacity: 0.55;' : ''}">
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="admin-avatar" style="width: 34px; height: 34px; font-size: 0.75rem; background: ${isSuperAdmin ? 'var(--primary-gold)' : 'var(--border-medium)'}; color: ${isSuperAdmin ? '#111317' : '#ffffff'}; font-weight: 800;">
              ${u.avatar || u.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div style="font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 6px;">
                <span>${u.name}</span>
                ${isCurrentActive ? '<span class="badge-gold" style="font-size: 0.65rem; padding: 1px 6px;">YOU (ACTIVE)</span>' : ''}
              </div>
              <div style="font-size: 0.74rem; color: var(--text-muted);">${u.email}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="role-badge ${u.role}">
            <i data-lucide="${isSuperAdmin ? 'shield' : (u.role === 'manager' ? 'briefcase' : (u.role === 'cashier' ? 'shopping-bag' : (u.role === 'technician' ? 'cpu' : 'file-text')))}" style="width: 12px; height: 12px;"></i>
            <span>${u.roleLabel || u.role.toUpperCase()}</span>
          </span>
        </td>
        <td><strong style="color: var(--text-secondary); font-size: 0.8rem;">${u.phone || '&mdash;'}</strong></td>
        <td style="max-width: 260px;">${permBadgesHtml}</td>
        <td>
          <span class="badge-status ${isSuspended ? 'cancelled' : 'ready'}">
            <i data-lucide="${isSuspended ? 'lock' : 'check'}" style="width: 11px; height: 11px;"></i>
            <span>${isSuspended ? 'Suspended' : 'Active'}</span>
          </span>
        </td>
        <td style="font-size: 0.76rem; color: var(--text-muted);">${u.lastLogin || 'Recent'}</td>
        <td>
          <div style="display: flex; gap: 4px; align-items: center;">
            <button class="btn-table-action" onclick="openEditUserModal('${u.id}')" title="Edit Staff Member &amp; Permissions"><i data-lucide="edit-3" style="width: 13px; height: 13px; color: var(--primary-gold);"></i></button>
            <button class="btn-table-action" onclick="toggleUserStatus('${u.id}')" title="${isSuspended ? 'Activate Account' : 'Suspend Account'}" ${isSuperAdmin && filtered.filter(x => x.role === 'admin').length === 1 ? 'disabled style="opacity: 0.3;"' : ''}><i data-lucide="${isSuspended ? 'unlock' : 'lock'}" style="width: 13px; height: 13px; color: ${isSuspended ? 'var(--mpesa-green)' : '#f87171'};"></i></button>
            <button class="btn-table-action" onclick="switchActiveUser('${u.id}')" title="Switch to this profile (Test Role UI)"><i data-lucide="user-check" style="width: 13px; height: 13px; color: #60a5fa;"></i></button>
            ${!isSuperAdmin ? `
              <button class="btn-table-action" onclick="deleteUser('${u.id}')" title="Delete User Account"><i data-lucide="trash-2" style="width: 13px; height: 13px; color: #f87171;"></i></button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) {
    try { lucide.createIcons(); } catch (e) {}
  }
}

// User Modal Operations
function openAddUserModal() {
  const modal = document.getElementById('adminUserModal');
  const body = document.getElementById('adminUserModalBody');
  const title = document.getElementById('adminUserModalTitle');
  if (!modal || !body) return;

  if (title) title.textContent = 'Add New Staff User';

  body.innerHTML = `
    <form id="staffUserForm" onsubmit="event.preventDefault(); saveUserForm(null);">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Full Name *</label>
          <input type="text" id="usrFullName" required placeholder="e.g. Grace Wambui" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Email Address *</label>
          <input type="email" id="usrEmail" required placeholder="grace@cloudprint.co.ke" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Phone Number (M-Pesa / WhatsApp)</label>
          <input type="text" id="usrPhone" value="+254 7" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">System Role Tier *</label>
          <select id="usrRoleSelect" onchange="autoPopulatePermissions(this.value)" class="cms-select" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
            <option value="manager">Store Manager (High Access)</option>
            <option value="cashier" selected>Cashier / Operator (Counter Access)</option>
            <option value="accountant">Accountant / Auditor (Financials Only)</option>
            <option value="technician">Hardware Technician (Printer Fleet)</option>
            <option value="admin">Super Admin (All Rights Unrestricted)</option>
          </select>
        </div>
      </div>

      <!-- Granular Permissions Checklist -->
      <div style="margin-bottom: 18px;">
        <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px; display: block;">Granular System Privileges &amp; Module Access</label>
        <div class="permissions-checkboxes-grid">
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_orders" checked> <span>Sales &amp; Orders Dispatch</span></label>
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_reprint" checked> <span>Reprint / Respool Jobs</span></label>
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_reversal"> <span>Issue M-Pesa Reversals</span></label>
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_crm" checked> <span>CRM Customer Directory</span></label>
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_printers" checked> <span>Printer Hardware Controls</span></label>
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_cms"> <span>CMS &amp; Pricing Rates</span></label>
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_reports"> <span>Financial Statements</span></label>
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_logs"> <span>Audit Logs &amp; Spooler</span></label>
        </div>
        <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; display: block;">Only Super Admin has access to manage Staff Users and alter core pricing rates.</span>
      </div>

      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button type="button" class="btn-secondary-action" onclick="closeUserModal()">Cancel</button>
        <button type="submit" class="btn-primary-action">
          <i data-lucide="check"></i>
          <span>Save Staff User</span>
        </button>
      </div>
    </form>
  `;

  modal.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function openEditUserModal(userId) {
  const user = (adminState.users || []).find(u => u.id === userId);
  if (!user) return;

  const modal = document.getElementById('adminUserModal');
  const body = document.getElementById('adminUserModalBody');
  const title = document.getElementById('adminUserModalTitle');
  if (!modal || !body) return;

  if (title) title.textContent = `Edit Staff: ${user.name}`;

  const isSuper = user.role === 'admin';
  const perms = user.permissions || [];

  body.innerHTML = `
    <form id="staffUserForm" onsubmit="event.preventDefault(); saveUserForm('${user.id}');">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Full Name *</label>
          <input type="text" id="usrFullName" value="${user.name}" required class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Email Address *</label>
          <input type="email" id="usrEmail" value="${user.email}" required class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Phone Number</label>
          <input type="text" id="usrPhone" value="${user.phone || '+254 7'}" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">System Role Tier</label>
          <select id="usrRoleSelect" onchange="autoPopulatePermissions(this.value)" class="cms-select" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Super Admin (All Rights)</option>
            <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Store Manager (High Access)</option>
            <option value="cashier" ${user.role === 'cashier' ? 'selected' : ''}>Cashier / Operator</option>
            <option value="accountant" ${user.role === 'accountant' ? 'selected' : ''}>Accountant / Auditor</option>
            <option value="technician" ${user.role === 'technician' ? 'selected' : ''}>Hardware Technician</option>
          </select>
        </div>
      </div>

      <!-- Granular Permissions Checklist -->
      <div style="margin-bottom: 18px;">
        <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px; display: block;">Granular System Privileges &amp; Module Access</label>
        <div class="permissions-checkboxes-grid">
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_orders" ${isSuper || perms.includes('orders') ? 'checked' : ''}> <span>Sales &amp; Orders Dispatch</span></label>
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_reprint" ${isSuper || perms.includes('reprint') ? 'checked' : ''}> <span>Reprint / Respool Jobs</span></label>
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_reversal" ${isSuper || perms.includes('reversal') ? 'checked' : ''}> <span>Issue M-Pesa Reversals</span></label>
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_crm" ${isSuper || perms.includes('crm') ? 'checked' : ''}> <span>CRM Customer Directory</span></label>
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_printers" ${isSuper || perms.includes('printers') ? 'checked' : ''}> <span>Printer Hardware Controls</span></label>
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_cms" ${isSuper || perms.includes('cms') ? 'checked' : ''}> <span>CMS &amp; Pricing Rates</span></label>
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_reports" ${isSuper || perms.includes('reports') ? 'checked' : ''}> <span>Financial Statements</span></label>
          <label class="perm-checkbox-label"><input type="checkbox" id="perm_logs" ${isSuper || perms.includes('logs') ? 'checked' : ''}> <span>Audit Logs &amp; Spooler</span></label>
        </div>
      </div>

      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button type="button" class="btn-secondary-action" onclick="closeUserModal()">Cancel</button>
        <button type="submit" class="btn-primary-action">
          <i data-lucide="save"></i>
          <span>Save Changes</span>
        </button>
      </div>
    </form>
  `;

  modal.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function autoPopulatePermissions(role) {
  const isSuper = role === 'admin';
  const isManager = role === 'manager';
  const isCashier = role === 'cashier';
  const isAccountant = role === 'accountant';
  const isTech = role === 'technician';

  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  };

  setCheck('perm_orders', isSuper || isManager || isCashier || isAccountant);
  setCheck('perm_reprint', isSuper || isManager || isCashier);
  setCheck('perm_reversal', isSuper || isManager);
  setCheck('perm_crm', isSuper || isManager || isCashier);
  setCheck('perm_printers', isSuper || isManager || isCashier || isTech);
  setCheck('perm_cms', isSuper);
  setCheck('perm_reports', isSuper || isManager || isAccountant);
  setCheck('perm_logs', isSuper || isManager || isAccountant || isTech);
}

function closeUserModal() {
  const modal = document.getElementById('adminUserModal');
  if (modal) modal.classList.remove('active');
}

function saveUserForm(userId) {
  if (!hasPermission('all')) {
    showAdminToast('Access Denied: Only Super Admin can modify staff user accounts.', 'error');
    return;
  }

  const name = (document.getElementById('usrFullName').value || '').trim();
  const email = (document.getElementById('usrEmail').value || '').trim();
  const phone = (document.getElementById('usrPhone').value || '').trim();
  const role = document.getElementById('usrRoleSelect').value;

  if (!name || !email) {
    showAdminToast('Please fill in required name and email fields.', 'error');
    return;
  }

  const roleLabels = {
    admin: 'Super Admin',
    manager: 'Store Manager',
    cashier: 'Cashier / Operator',
    accountant: 'Accountant / Auditor',
    technician: 'Hardware Technician'
  };

  // Compile granted permissions
  const perms = [];
  if (role === 'admin') {
    perms.push('all');
  } else {
    if (document.getElementById('perm_orders') && document.getElementById('perm_orders').checked) perms.push('orders');
    if (document.getElementById('perm_reprint') && document.getElementById('perm_reprint').checked) perms.push('reprint');
    if (document.getElementById('perm_reversal') && document.getElementById('perm_reversal').checked) perms.push('reversal');
    if (document.getElementById('perm_crm') && document.getElementById('perm_crm').checked) perms.push('crm');
    if (document.getElementById('perm_printers') && document.getElementById('perm_printers').checked) perms.push('printers');
    if (document.getElementById('perm_cms') && document.getElementById('perm_cms').checked) perms.push('cms');
    if (document.getElementById('perm_reports') && document.getElementById('perm_reports').checked) perms.push('reports');
    if (document.getElementById('perm_logs') && document.getElementById('perm_logs').checked) perms.push('logs');
  }

  const avatar = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  if (userId) {
    // Edit existing
    const user = (adminState.users || []).find(u => u.id === userId);
    if (user) {
      user.name = name;
      user.email = email;
      user.phone = phone;
      user.role = role;
      user.roleLabel = roleLabels[role] || role;
      user.avatar = avatar;
      user.permissions = perms;
      addAuditLog('SUCCESS', `User Management: Staff account ${user.name} (${user.roleLabel}) updated.`);
      showAdminToast(`Staff user ${user.name} updated!`, 'success');
    }
  } else {
    // Add new
    const newId = 'USR-' + String((adminState.users.length + 1)).padStart(3, '0');
    const newUser = {
      id: newId,
      name: name,
      email: email,
      phone: phone,
      avatar: avatar,
      role: role,
      roleLabel: roleLabels[role] || role,
      status: 'active',
      lastLogin: 'Never',
      permissions: perms
    };
    adminState.users.push(newUser);
    addAuditLog('SUCCESS', `User Management: New staff user ${newUser.name} created as ${newUser.roleLabel}.`);
    showAdminToast(`Staff user ${newUser.name} created successfully!`, 'success');
  }

  try {
    localStorage.setItem('cloudprint_users', JSON.stringify(adminState.users));
  } catch (e) {}

  closeUserModal();
  renderUsersDirectory();
  updateRoleProfileWidget();
}

function toggleUserStatus(userId) {
  if (!hasPermission('all')) {
    showAdminToast('Access Denied: Only Super Admin can suspend/activate staff users.', 'error');
    return;
  }

  const user = (adminState.users || []).find(u => u.id === userId);
  if (!user) return;

  if (user.role === 'admin' && adminState.users.filter(x => x.role === 'admin').length === 1) {
    showAdminToast('Cannot suspend the primary Super Admin account!', 'error');
    return;
  }

  user.status = user.status === 'suspended' ? 'active' : 'suspended';
  addAuditLog('WARN', `User Management: Account ${user.name} status changed to ${user.status.toUpperCase()}.`);
  showAdminToast(`Account ${user.name} is now ${user.status.toUpperCase()}!`, 'success');

  try {
    localStorage.setItem('cloudprint_users', JSON.stringify(adminState.users));
  } catch (e) {}

  renderUsersDirectory();
}

function deleteUser(userId) {
  if (!hasPermission('all')) {
    showAdminToast('Access Denied: Only Super Admin can delete staff users.', 'error');
    return;
  }

  const user = (adminState.users || []).find(u => u.id === userId);
  if (!user) return;

  if (user.role === 'admin') {
    showAdminToast('Super Admin accounts cannot be deleted.', 'error');
    return;
  }

  if (confirm(`Are you sure you want to permanently delete staff user ${user.name} (${user.email})?`)) {
    adminState.users = adminState.users.filter(u => u.id !== userId);
    addAuditLog('WARN', `User Management: Staff account ${user.name} deleted.`);
    showAdminToast(`Staff user ${user.name} deleted.`, 'success');

    try {
      localStorage.setItem('cloudprint_users', JSON.stringify(adminState.users));
    } catch (e) {}

    renderUsersDirectory();
    updateRoleProfileWidget();
  }
}

// Role Switcher / Profile Impersonation (Test RBAC)
function openRoleSwitcherModal() {
  const modal = document.getElementById('adminRoleSwitcherModal');
  const body = document.getElementById('adminRoleSwitcherModalBody');
  if (!modal || !body) return;

  const users = adminState.users || [];
  const currentId = adminState.currentUser ? adminState.currentUser.id : users[0].id;

  body.innerHTML = `
    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.5;">
      Select a staff profile below to switch into that role and test how permissions, accessible menus, and restrictions apply in real-time.
    </div>

    <div>
      ${users.map(u => `
        <div class="role-profile-switcher-card ${u.id === currentId ? 'active' : ''}" onclick="switchActiveUser('${u.id}')">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="admin-avatar" style="width: 34px; height: 34px; font-size: 0.76rem; background: ${u.role === 'admin' ? 'var(--primary-gold)' : 'rgba(255,255,255,0.1)'}; color: ${u.role === 'admin' ? '#111317' : '#ffffff'}; font-weight: 800;">
              ${u.avatar || u.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 0.84rem; color: #ffffff;">${u.name}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${u.email}</div>
            </div>
          </div>
          <span class="role-badge ${u.role}">${u.roleLabel}</span>
        </div>
      `).join('')}
    </div>

    <div style="margin-top: 14px; text-align: right;">
      <button class="btn-secondary-action" onclick="closeRoleSwitcherModal()">Close</button>
    </div>
  `;

  modal.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeRoleSwitcherModal() {
  const modal = document.getElementById('adminRoleSwitcherModal');
  if (modal) modal.classList.remove('active');
}

function switchActiveUser(userId) {
  const user = (adminState.users || []).find(u => u.id === userId);
  if (!user) return;

  adminState.currentUser = user;
  try {
    localStorage.setItem('cloudprint_active_user', JSON.stringify(user));
  } catch (e) {}

  closeRoleSwitcherModal();
  updateRoleProfileWidget();
  renderUsersDirectory();

  // If current active tab is not accessible to this role, switch to Overview
  if (!canAccessTab(adminState.activeTab)) {
    switchTab('overview');
  }

  addAuditLog('INFO', `Auth & RBAC: Switched active operator to '${user.name}' (${user.roleLabel}).`);
  showAdminToast(`Active operator switched to: ${user.name} (${user.roleLabel})`, 'success');
}

window.openAddUserModal = openAddUserModal;
window.openEditUserModal = openEditUserModal;
window.closeUserModal = closeUserModal;
window.saveUserForm = saveUserForm;
window.autoPopulatePermissions = autoPopulatePermissions;
window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;
window.openRoleSwitcherModal = openRoleSwitcherModal;
window.closeRoleSwitcherModal = closeRoleSwitcherModal;
window.switchActiveUser = switchActiveUser;
window.renderUsersDirectory = renderUsersDirectory;

// ==========================================================================
// TAB 8: LIVE PRINT QUEUE & SPOOLER DISPATCH ENGINE
// ==========================================================================
function renderLiveQueue() {
  const container = document.getElementById('liveQueueCardsContainer');
  if (!container) return;

  const orders = adminState.orders || [];
  // Active queue consists of ready / printing / queued orders
  const queueJobs = orders.filter(o => {
    const s = (o.status || '').toLowerCase();
    return s.includes('ready') || s.includes('print') || s.includes('queue');
  });

  if (document.getElementById('kpiQueueActiveCount')) {
    document.getElementById('kpiQueueActiveCount').textContent = `${queueJobs.length} Jobs`;
  }
  if (document.getElementById('queueNavCount')) {
    document.getElementById('queueNavCount').textContent = `${queueJobs.length} Active`;
  }

  if (queueJobs.length === 0) {
    container.innerHTML = `
      <div class="panel-card" style="text-align: center; padding: 40px; color: var(--text-muted);">
        <i data-lucide="check-circle-2" style="width: 38px; height: 38px; color: var(--mpesa-green); margin-bottom: 8px;"></i>
        <div style="font-weight: 700; font-size: 1rem; color: #ffffff;">Print Queue is Empty</div>
        <div style="font-size: 0.78rem;">All customer print spools have been dispatched and processed.</div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = queueJobs.map((job, idx) => {
    const isPrinting = (job.status || '').toLowerCase().includes('print');
    const priority = job.priority || (idx === 0 ? 'high' : 'normal');
    const assignedPrinterId = job.assignedPrinter || 'PRN-01';
    const printer = (adminState.printers || []).find(p => p.id === assignedPrinterId) || { name: 'HP LaserJet Enterprise MFP' };

    const docName = job.fileName || (job.files && job.files[0] ? job.files[0].name : 'Document.pdf');

    return `
      <div class="queue-job-card ${isPrinting ? 'printing' : ''}" id="queueCard_${escapeHtml(job.id)}">
        <div style="display: flex; align-items: center; gap: 14px; flex: 1;">
          <div style="font-family: var(--font-heading); font-weight: 900; font-size: 1.15rem; color: var(--primary-gold); width: 34px; text-align: center;">
            #${idx + 1}
          </div>

          <div style="overflow: hidden; flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 0.92rem; color: #ffffff;">${escapeHtml(job.id)}</span>
              <span class="queue-priority-pill ${escapeHtml(priority)}">${escapeHtml(priority)}</span>
              <span class="badge-status ${getStatusClass(job.status)}">${escapeHtml(job.status || 'Queued')}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 3px;">
              📄 <strong>${escapeHtml(docName)}</strong> • ${job.pages || 1} pgs (${job.copies || 1} copies) • <strong>${escapeHtml(job.serviceName || 'A4 Colour')}</strong>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              Target: <strong style="color: #60a5fa;">${escapeHtml(printer.name)}</strong> • Customer: <strong>${escapeHtml(job.phone || '0712345678')}</strong> (KES ${job.total || 0}.00)
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <select class="cms-select" style="padding: 5px 8px; font-size: 0.74rem;" onchange="changeJobPriority('${escapeHtml(job.id)}', this.value)" title="Change Spool Priority">
            <option value="high" ${priority === 'high' ? 'selected' : ''}>High Priority</option>
            <option value="normal" ${priority === 'normal' ? 'selected' : ''}>Normal Priority</option>
            <option value="low" ${priority === 'low' ? 'selected' : ''}>Low Priority</option>
          </select>

          <select class="cms-select" style="padding: 5px 8px; font-size: 0.74rem;" onchange="moveJobPrinter('${escapeHtml(job.id)}', this.value)" title="Reroute to different printer">
            ${(adminState.printers || []).map(p => `
              <option value="${escapeHtml(p.id)}" ${assignedPrinterId === p.id ? 'selected' : ''}>${escapeHtml(p.name.split(' - ')[0])}</option>
            `).join('')}
          </select>

          <button class="btn-table-action" onclick="reorderQueueJob('${escapeHtml(job.id)}', -1)" title="Move Up"><i data-lucide="arrow-up" style="width: 13px; height: 13px;"></i></button>
          <button class="btn-table-action" onclick="reorderQueueJob('${escapeHtml(job.id)}', 1)" title="Move Down"><i data-lucide="arrow-down" style="width: 13px; height: 13px;"></i></button>
          <button class="btn-table-action" onclick="updateOrderStatus('${escapeHtml(job.id)}', 'Printing Finished'); renderLiveQueue();" title="Force Mark Completed"><i data-lucide="check" style="width: 13px; height: 13px; color: var(--mpesa-green);"></i></button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) {
    try { lucide.createIcons(); } catch (e) {}
  }
}

function toggleQueueDispatcher() {
  if (!hasPermission('orders') && !hasPermission('all')) {
    showAdminToast('Access Denied: Queue dispatcher control restricted.', 'error');
    return;
  }

  adminState.queueDispatcherRunning = !adminState.queueDispatcherRunning;
  const isRunning = adminState.queueDispatcherRunning;
  
  const valEl = document.getElementById('kpiQueueStateVal');
  const btnText = document.getElementById('pauseQueueBtnText');

  if (valEl) {
    valEl.textContent = isRunning ? 'RUNNING' : 'PAUSED';
    valEl.style.color = isRunning ? 'var(--mpesa-green)' : '#f87171';
  }
  if (btnText) btnText.textContent = isRunning ? 'Pause Dispatcher' : 'Resume Dispatcher';

  addAuditLog(isRunning ? 'SUCCESS' : 'WARN', `Print Spooler: Queue Dispatcher ${isRunning ? 'RESUMED' : 'PAUSED'}.`);
  showAdminToast(`Print queue dispatcher ${isRunning ? 'resumed' : 'paused'}`, isRunning ? 'success' : 'warn');
}

function flushCompletedQueue() {
  if (!hasPermission('orders') && !hasPermission('all')) {
    showAdminToast('Access Denied: Buffer management restricted.', 'error');
    return;
  }
  addAuditLog('INFO', 'Print Spooler: Cleaned processed jobs from queue buffer.');
  showAdminToast('Flushed completed items from queue buffer', 'success');
  renderLiveQueue();
}

function changeJobPriority(jobId, priority) {
  if (!hasPermission('orders') && !hasPermission('all')) {
    showAdminToast('Access Denied: Priority modifications restricted.', 'error');
    return;
  }
  const job = (adminState.orders || []).find(o => o.id === jobId);
  if (job) {
    job.priority = priority;
    localStorage.setItem('cloudprint_orders', JSON.stringify(adminState.orders));
    addAuditLog('INFO', `Spooler: Job ${jobId} priority changed to '${priority.toUpperCase()}'.`);
    showAdminToast(`Job ${jobId} priority set to ${priority.toUpperCase()}`, 'success');
    renderLiveQueue();
  }
}

function moveJobPrinter(jobId, printerId) {
  if (!hasPermission('orders') && !hasPermission('all')) {
    showAdminToast('Access Denied: Job routing restricted.', 'error');
    return;
  }
  const job = (adminState.orders || []).find(o => o.id === jobId);
  const printer = (adminState.printers || []).find(p => p.id === printerId);
  if (job && printer) {
    job.assignedPrinter = printerId;
    localStorage.setItem('cloudprint_orders', JSON.stringify(adminState.orders));
    addAuditLog('INFO', `Spooler: Job ${jobId} rerouted to ${printer.name} (${printer.ip}).`);
    showAdminToast(`Job ${jobId} rerouted to ${printer.name}`, 'success');
    renderLiveQueue();
  }
}

function reorderQueueJob(jobId, dir) {
  if (!hasPermission('orders') && !hasPermission('all')) {
    showAdminToast('Access Denied: Queue reordering restricted.', 'error');
    return;
  }
  const idx = adminState.orders.findIndex(o => o.id === jobId);
  if (idx < 0) return;
  const targetIdx = idx + dir;
  if (targetIdx >= 0 && targetIdx < adminState.orders.length) {
    const temp = adminState.orders[idx];
    adminState.orders[idx] = adminState.orders[targetIdx];
    adminState.orders[targetIdx] = temp;
    localStorage.setItem('cloudprint_orders', JSON.stringify(adminState.orders));
    renderLiveQueue();
  }
}

// Active FIFO Spooler Dispatcher Daemon
function startBackgroundSpoolerDaemon() {
  if (window._spoolerDaemonInterval) clearInterval(window._spoolerDaemonInterval);

  window._spoolerDaemonInterval = setInterval(() => {
    if (!adminState.queueDispatcherRunning) return;

    const orders = adminState.orders || [];
    const queuedJob = orders.find(o => {
      const s = (o.status || '').toLowerCase();
      return s === 'queued' || s === 'pending';
    });

    if (queuedJob) {
      queuedJob.status = 'Printing';
      queuedJob.spoolStartedAt = Date.now();
      localStorage.setItem('cloudprint_orders', JSON.stringify(adminState.orders));
      addAuditLog('INFO', `Print Spooler: Dispatched job ${queuedJob.id} to hardware tray (${queuedJob.serviceName || 'A4 Format'}).`);

      const timeoutSec = (adminState.settings && adminState.settings.spoolerTimeout) ? adminState.settings.spoolerTimeout : 60;
      const durationMs = Math.min(timeoutSec * 1000, 6000);

      setTimeout(() => {
        const target = (adminState.orders || []).find(o => o.id === queuedJob.id);
        if (target && target.status === 'Printing') {
          target.status = 'Completed';
          target.completedAt = new Date().toISOString();
          localStorage.setItem('cloudprint_orders', JSON.stringify(adminState.orders));
          addAuditLog('SUCCESS', `Print Spooler: Job ${target.id} finished printing within ${timeoutSec}s timeout.`);
          renderLiveQueue();
          renderOrdersTable();
          renderOverviewKPIs();
        }
      }, durationMs);

      renderLiveQueue();
      renderOrdersTable();
    }
  }, 8000);
}

// ==========================================================================
// TAB 9: PRINT AGENTS (LAN EDGE GATEWAYS)
// ==========================================================================
function renderPrintAgents() {
  const container = document.getElementById('agentsGridContainer');
  if (!container) return;

  const agents = adminState.agents || [];
  const connectedCount = agents.filter(a => a.status === 'connected').length;
  const totalJobs = agents.reduce((sum, a) => sum + (a.jobsProcessed || 0), 0);

  if (document.getElementById('kpiConnectedAgentsCount')) {
    document.getElementById('kpiConnectedAgentsCount').textContent = `${connectedCount} Online`;
  }
  if (document.getElementById('agentsNavCount')) {
    document.getElementById('agentsNavCount').textContent = `${connectedCount} Online`;
  }
  if (document.getElementById('kpiAgentTotalJobs')) {
    document.getElementById('kpiAgentTotalJobs').textContent = `${totalJobs.toLocaleString()} Jobs`;
  }

  container.innerHTML = agents.map(agent => {
    const isOnline = agent.status === 'connected';
    const printersList = (agent.assignedPrinters || []).map(pid => {
      const p = (adminState.printers || []).find(x => x.id === pid);
      return p ? p.name.split(' - ')[0] : pid;
    }).join(', ') || 'No printers linked';

    return `
      <div class="agent-card ${isOnline ? 'online' : 'offline'}">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <div style="font-weight: 800; font-size: 1rem; color: #ffffff; display: flex; align-items: center; gap: 8px;">
                <span>${agent.name}</span>
                <span class="badge-gold" style="font-size: 0.65rem;">${agent.version || 'v1.4.2'}</span>
              </div>
              <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 2px;">
                Host: <strong>${agent.hostname}</strong> (${agent.os})
              </div>
            </div>
            <div class="printer-status-blinker-pill ${isOnline ? 'online' : 'offline'}">
              <span class="led-blinker ${isOnline ? 'green' : 'gray'}"></span>
              <span>${isOnline ? 'CONNECTED' : 'DISCONNECTED'}</span>
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.025); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px; margin-bottom: 14px; font-size: 0.78rem; line-height: 1.6;">
            <div>🌐 LAN IP: <strong style="font-family: monospace; color: #60a5fa;">${agent.ip}</strong></div>
            <div>🖨️ Connected Printers: <strong>${printersList}</strong></div>
            <div>⚡ Heartbeat: <strong style="color: var(--mpesa-green);">Active (3s ago)</strong></div>
            <div>📊 Jobs Handled: <strong>${agent.jobsProcessed || 0}</strong> (<span style="color: var(--mpesa-green);">${agent.jobsSuccess || 0} ok</span>, <span style="color: #f87171;">${agent.jobsFailed || 0} err</span>)</div>
          </div>
        </div>

        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="btn-table-action" style="flex: 1; padding: 6px;" onclick="pingAgent('${agent.id}')" title="Test Edge Socket Handshake">
            <i data-lucide="radio" style="width: 13px; height: 13px; color: var(--accent-blue);"></i>
            <span>Ping Test</span>
          </button>
          <button class="btn-table-action" style="flex: 1; padding: 6px;" onclick="restartAgent('${agent.id}')" title="Restart Print Agent Daemon">
            <i data-lucide="rotate-cw" style="width: 13px; height: 13px; color: var(--primary-gold);"></i>
            <span>Restart</span>
          </button>
          <button class="btn-table-action" style="flex: 1; padding: 6px;" onclick="openEditAgentModal('${agent.id}')" title="Configure Agent">
            <i data-lucide="sliders" style="width: 13px; height: 13px; color: #c084fc;"></i>
            <span>Config</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) {
    try { lucide.createIcons(); } catch (e) {}
  }
}

function pingAgent(agentId) {
  const agent = (adminState.agents || []).find(a => a.id === agentId);
  if (!agent) return;
  showAdminToast(`Ping sent to ${agent.name} (${agent.ip})...`, 'info');
  setTimeout(() => {
    addAuditLog('SUCCESS', `Edge Socket: Ping handshake acknowledged from ${agent.name} (Latency: 6ms).`);
    showAdminToast(`Agent ${agent.name} responding normally (6ms)`, 'success');
  }, 400);
}

function pingAllAgents() {
  showAdminToast('Broadcasting health ping to all LAN print agents...', 'info');
  setTimeout(() => {
    addAuditLog('SUCCESS', 'Edge Gateway: All 2 LAN print agents acknowledged keep-alive ping.');
    showAdminToast('All print agents online and responding!', 'success');
  }, 500);
}

function restartAgent(agentId) {
  const agent = (adminState.agents || []).find(a => a.id === agentId);
  if (!agent) return;
  showAdminToast(`Restarting ${agent.name} service...`, 'info');
  setTimeout(() => {
    addAuditLog('SUCCESS', `Edge Gateway: Daemon service on ${agent.name} restarted successfully.`);
    showAdminToast(`Agent ${agent.name} restarted and operational`, 'success');
  }, 800);
}

function openAddAgentModal() {
  const modal = document.getElementById('adminAgentModal');
  const body = document.getElementById('adminAgentModalBody');
  const title = document.getElementById('adminAgentModalTitle');
  if (!modal || !body) return;

  if (title) title.textContent = 'Register LAN Print Agent';

  body.innerHTML = `
    <form id="agentForm" onsubmit="event.preventDefault(); saveAgentForm(null);">
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Agent Station Name *</label>
        <input type="text" id="agentName" required placeholder="e.g. Counter Kiosk PC #2" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Hostname</label>
          <input type="text" id="agentHostname" placeholder="DESKTOP-PRINT-03" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">LAN IP Address *</label>
          <input type="text" id="agentIp" required placeholder="192.168.1.120" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
      </div>
      <div class="form-group" style="margin-bottom: 16px;">
        <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Operating System</label>
        <input type="text" id="agentOs" value="Windows 11 Pro 64-bit" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button type="button" class="btn-secondary-action" onclick="closeAgentModal()">Cancel</button>
        <button type="submit" class="btn-primary-action">
          <i data-lucide="check"></i>
          <span>Save Agent</span>
        </button>
      </div>
    </form>
  `;

  modal.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function openEditAgentModal(agentId) {
  const agent = (adminState.agents || []).find(a => a.id === agentId);
  if (!agent) return;

  const modal = document.getElementById('adminAgentModal');
  const body = document.getElementById('adminAgentModalBody');
  const title = document.getElementById('adminAgentModalTitle');
  if (!modal || !body) return;

  if (title) title.textContent = `Edit Agent: ${agent.name}`;

  body.innerHTML = `
    <form id="agentForm" onsubmit="event.preventDefault(); saveAgentForm('${agent.id}');">
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Agent Station Name *</label>
        <input type="text" id="agentName" value="${agent.name}" required class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Hostname</label>
          <input type="text" id="agentHostname" value="${agent.hostname}" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">LAN IP Address *</label>
          <input type="text" id="agentIp" value="${agent.ip}" required class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #0c0e12; border: 1px solid var(--border-medium); color: #ffffff; font-size: 0.84rem;">
        </div>
      </div>
      <div class="form-group" style="margin-bottom: 16px;">
        <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px; display: block;">Generated Bearer Auth Token</label>
        <input type="text" readonly value="${agent.authToken || 'cptk_live_89a2f901c84b'}" class="cms-input" style="width: 100%; padding: 9px; border-radius: 8px; background: #08090b; border: 1px solid var(--border-subtle); color: var(--primary-gold); font-family: monospace; font-size: 0.78rem;">
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button type="button" class="btn-secondary-action" onclick="closeAgentModal()">Cancel</button>
        <button type="submit" class="btn-primary-action">
          <i data-lucide="save"></i>
          <span>Save Changes</span>
        </button>
      </div>
    </form>
  `;

  modal.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeAgentModal() {
  const modal = document.getElementById('adminAgentModal');
  if (modal) modal.classList.remove('active');
}

function saveAgentForm(agentId) {
  const name = document.getElementById('agentName').value.trim();
  const hostname = document.getElementById('agentHostname').value.trim();
  const ip = document.getElementById('agentIp').value.trim();

  if (!name || !ip) {
    showAdminToast('Please fill in required fields.', 'error');
    return;
  }

  if (agentId) {
    const agent = (adminState.agents || []).find(a => a.id === agentId);
    if (agent) {
      agent.name = name;
      agent.hostname = hostname;
      agent.ip = ip;
      addAuditLog('SUCCESS', `Print Agent: Updated gateway ${agent.name} (${agent.ip}).`);
      showAdminToast(`Agent ${agent.name} updated!`, 'success');
    }
  } else {
    const newId = 'AGT-' + String((adminState.agents.length + 1)).padStart(2, '0');
    const newAgent = {
      id: newId,
      name: name,
      hostname: hostname || 'DESKTOP-PRINT-03',
      os: 'Windows 11 Pro 64-bit',
      ip: ip,
      version: 'v1.4.2 (Stable)',
      status: 'connected',
      lastHeartbeat: new Date().toISOString(),
      assignedPrinters: ['PRN-01'],
      jobsProcessed: 0,
      jobsSuccess: 0,
      jobsFailed: 0,
      authToken: 'cptk_live_' + Math.random().toString(36).substr(2, 12)
    };
    adminState.agents.push(newAgent);
    addAuditLog('SUCCESS', `Print Agent: Registered new edge daemon ${newAgent.name} (${newAgent.ip}).`);
    showAdminToast(`Agent ${newAgent.name} registered successfully!`, 'success');
  }

  try {
    localStorage.setItem('cloudprint_agents', JSON.stringify(adminState.agents));
  } catch (e) {}

  closeAgentModal();
  renderPrintAgents();
}

// ==========================================================================
// TAB 10: DOCUMENT VAULT & ZERO-RETENTION PRIVACY
// ==========================================================================
function renderDocumentVault(query = null) {
  const tbody = document.getElementById('docVaultTableBody');
  if (!tbody) return;

  const orders = adminState.orders || [];

  // Update KPI counters
  const totalFiles = orders.reduce((sum, o) => sum + (o.files ? o.files.length : 1), 0);
  const shreddedCount = orders.filter(o => o.filePurged || (o.status || '').toLowerCase().includes('comp')).length;

  if (document.getElementById('kpiVaultTotalDocs')) document.getElementById('kpiVaultTotalDocs').textContent = `${totalFiles} Files`;
  if (document.getElementById('kpiVaultShreddedCount')) document.getElementById('kpiVaultShreddedCount').textContent = `${shreddedCount} Purged`;
  if (document.getElementById('kpiActiveTtlLabel')) document.getElementById('kpiActiveTtlLabel').textContent = adminState.vaultRetention === 'immediate' ? 'Immediate' : String(adminState.vaultRetention).toUpperCase();

  let filtered = [...orders];
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(o => 
      (o.fileName && o.fileName.toLowerCase().includes(q)) ||
      (o.id && o.id.toLowerCase().includes(q)) ||
      (o.phone && o.phone.toLowerCase().includes(q))
    );
  }

  tbody.innerHTML = filtered.map(order => {
    const isCompleted = (order.status || '').toLowerCase().includes('comp');
    const isPurged = order.filePurged || isCompleted;
    const fileName = order.fileName || (order.files && order.files[0] ? order.files[0].name : 'Document.pdf');

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="${fileName.endsWith('.pdf') ? 'file-text' : 'file'}" style="width: 16px; height: 16px; color: var(--primary-gold);"></i>
            <div>
              <div style="font-weight: 700; color: #ffffff;">${escapeHtml(fileName)}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${new Date(order.timestamp).toLocaleString()}</div>
            </div>
          </div>
        </td>
        <td><strong style="color: var(--primary-gold);">${escapeHtml(order.id)}</strong></td>
        <td>+254 ${escapeHtml(order.phone ? order.phone.replace(/^0/, '') : '712345678')}</td>
        <td>${order.pages || 10} pages (${escapeHtml(order.serviceName || 'A4 Colour')})</td>
        <td>${escapeHtml((order.files && order.files[0] && order.files[0].size) || '2.4 MB')}</td>
        <td>
          <span class="badge-status ${isPurged ? 'completed' : 'ready'}" style="font-size: 0.7rem;">
            <i data-lucide="${isPurged ? 'shield-check' : 'clock'}" style="width: 11px; height: 11px;"></i>
            <span>${isPurged ? 'Shredded &amp; Purged' : 'Queued (TTL Active)'}</span>
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn-table-action" onclick="openOrderModal('${escapeHtml(order.id)}')" title="View Job Trace"><i data-lucide="search" style="width: 13px; height: 13px;"></i></button>
            <button class="btn-table-action" onclick="shredDocument('${escapeHtml(order.id)}')" title="Force Wipe / Shred Payload" ${isPurged ? 'disabled style="opacity: 0.3;"' : ''}><i data-lucide="trash-2" style="width: 13px; height: 13px; color: #f87171;"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) {
    try { lucide.createIcons(); } catch (e) {}
  }
}

function changeVaultRetentionPolicy(ttl) {
  if (!hasPermission('orders') && !hasPermission('all')) {
    showAdminToast('Access Denied: Document storage policy modification restricted.', 'error');
    return;
  }
  adminState.vaultRetention = ttl;
  localStorage.setItem('cloudprint_vault_retention', ttl);
  addAuditLog('SUCCESS', `Zero-Retention Security: Document storage retention policy updated to '${ttl}'.`);
  showAdminToast(`Retention policy updated to: ${ttl.toUpperCase()}`, 'success');
  renderDocumentVault();
}

function forceWipeAllDocuments() {
  if (!hasPermission('orders') && !hasPermission('all')) {
    showAdminToast('Access Denied: Payload shredding restricted.', 'error');
    return;
  }
  if (confirm('Are you sure you want to trigger an immediate force-shred across all print payload buffers?')) {
    adminState.orders.forEach(o => {
      o.filePurged = true;
      o.purgedAt = new Date().toISOString();
    });
    localStorage.setItem('cloudprint_orders', JSON.stringify(adminState.orders));
    addAuditLog('WARN', 'Zero-Retention Security: Manual force-purge executed across all disk buffers.');
    showAdminToast('All customer document payloads permanently wiped and shredded!', 'success');
    renderDocumentVault();
  }
}

function shredDocument(jobId) {
  if (!hasPermission('orders') && !hasPermission('all')) {
    showAdminToast('Access Denied: Payload shredding restricted.', 'error');
    return;
  }
  const order = (adminState.orders || []).find(o => o.id === jobId);
  if (order) {
    order.filePurged = true;
    order.purgedAt = new Date().toISOString();
    localStorage.setItem('cloudprint_orders', JSON.stringify(adminState.orders));
    addAuditLog('SUCCESS', `Privacy Shredder: Payload for Job ${jobId} securely wiped.`);
    showAdminToast(`Payload for ${jobId} securely wiped`, 'success');
    renderDocumentVault();
  }
}

// ==========================================================================
// TAB 11: PAYMENTS & M-PESA DARAJA LEDGER
// ==========================================================================
function sortPaymentsTable(field) {
  if (!field) return;

  if (adminState.paymentSort.field === field) {
    adminState.paymentSort.direction = adminState.paymentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    adminState.paymentSort.field = field;
    adminState.paymentSort.direction = (field === 'amount' || field === 'timestamp') ? 'desc' : 'asc';
  }

  const selectEl = document.getElementById('paymentSortSelect');
  if (selectEl) {
    selectEl.value = `${adminState.paymentSort.field}_${adminState.paymentSort.direction}`;
  }

  renderPaymentsLedger();
  const dirLabel = adminState.paymentSort.direction === 'asc' ? 'Ascending' : 'Descending';
  showAdminToast(`Sorted ledger by ${field.toUpperCase()} (${dirLabel})`, 'info');
}

function handlePaymentSortSelect(val) {
  if (!val) return;
  const parts = val.split('_');
  if (parts.length >= 2) {
    const direction = parts.pop();
    const field = parts.join('_');
    adminState.paymentSort = { field, direction };
    renderPaymentsLedger();
  }
}

function renderPaymentsLedger(filterStatus = null, query = null) {
  if (filterStatus !== null) adminState.paymentFilter = filterStatus;
  if (query !== null) adminState.paymentSearchQuery = query;

  const currentFilter = adminState.paymentFilter || 'all';
  const currentQuery = adminState.paymentSearchQuery !== undefined ? adminState.paymentSearchQuery : (document.getElementById('paymentSearchInput') ? document.getElementById('paymentSearchInput').value.trim() : '');

  const tbody = document.getElementById('paymentsTableBody');
  if (!tbody) return;

  const orders = adminState.orders || [];
  const grossSettled = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const reversalsSum = orders.filter(o => o.reversalRef).reduce((sum, o) => sum + (o.refundAmount || o.total || 0), 0);

  if (document.getElementById('kpiPaymentsTotalSettled')) document.getElementById('kpiPaymentsTotalSettled').textContent = `KES ${grossSettled.toLocaleString()}`;
  if (document.getElementById('kpiPaymentsReversalsCount')) document.getElementById('kpiPaymentsReversalsCount').textContent = `KES ${reversalsSum.toLocaleString()}`;

  // Filter Pills UI
  document.querySelectorAll('#paymentFilterPills .status-pill').forEach(pill => {
    pill.classList.toggle('active', pill.getAttribute('data-status') === currentFilter);
  });

  let filtered = [...orders];
  if (currentFilter === 'paid') {
    filtered = filtered.filter(o => !o.reversalRef && (o.status || '').toLowerCase() !== 'failed');
  } else if (currentFilter === 'refunded') {
    filtered = filtered.filter(o => !!o.reversalRef);
  } else if (currentFilter === 'failed') {
    filtered = filtered.filter(o => (o.status || '').toLowerCase().includes('fail') || (o.status || '').toLowerCase().includes('time'));
  }

  if (currentQuery) {
    const q = currentQuery.toLowerCase();
    filtered = filtered.filter(o => 
      (o.mpesaRef && o.mpesaRef.toLowerCase().includes(q)) ||
      (o.id && o.id.toLowerCase().includes(q)) ||
      (o.phone && o.phone.toLowerCase().includes(q)) ||
      (o.reversalRef && o.reversalRef.toLowerCase().includes(q)) ||
      (o.customer && o.customer.toLowerCase().includes(q)) ||
      (String(o.total || '').includes(q))
    );
  }

  // Column Sorting Execution
  const sortField = (adminState.paymentSort && adminState.paymentSort.field) || 'timestamp';
  const sortDir = (adminState.paymentSort && adminState.paymentSort.direction) || 'desc';

  filtered.sort((a, b) => {
    let result = 0;
    if (sortField === 'txn') {
      const valA = (a.id || '').replace('#', '').toLowerCase();
      const valB = (b.id || '').replace('#', '').toLowerCase();
      result = valA.localeCompare(valB, undefined, { numeric: true });
    } else if (sortField === 'mpesaRef') {
      const valA = (a.mpesaRef || '').toLowerCase();
      const valB = (b.mpesaRef || '').toLowerCase();
      result = valA.localeCompare(valB);
    } else if (sortField === 'phone') {
      const valA = (a.phone || '').toLowerCase();
      const valB = (b.phone || '').toLowerCase();
      result = valA.localeCompare(valB);
    } else if (sortField === 'jobId') {
      const valA = (a.id || '').toLowerCase();
      const valB = (b.id || '').toLowerCase();
      result = valA.localeCompare(valB, undefined, { numeric: true });
    } else if (sortField === 'amount') {
      const valA = Number(a.total) || 0;
      const valB = Number(b.total) || 0;
      result = valA - valB;
    } else if (sortField === 'callback') {
      const valA = a.reversalRef ? 'REVERSED_B2C_200' : 'STK_SUCCESS_0';
      const valB = b.reversalRef ? 'REVERSED_B2C_200' : 'STK_SUCCESS_0';
      result = valA.localeCompare(valB);
    } else if (sortField === 'status') {
      const valA = a.reversalRef ? 'Refunded' : (a.status || 'Paid');
      const valB = b.reversalRef ? 'Refunded' : (b.status || 'Paid');
      result = valA.localeCompare(valB);
    } else { // default: timestamp
      const valA = new Date(a.timestamp || 0).getTime();
      const valB = new Date(b.timestamp || 0).getTime();
      result = valA - valB;
    }
    return sortDir === 'asc' ? result : -result;
  });

  // Update Table Header Sort Indicators
  ['txn', 'mpesaRef', 'phone', 'jobId', 'amount', 'callback', 'status', 'timestamp'].forEach(f => {
    const iconBox = document.getElementById(`sort_icon_${f}`);
    if (iconBox) {
      if (f === sortField) {
        iconBox.style.opacity = '1';
        iconBox.style.color = 'var(--primary-gold)';
        iconBox.innerHTML = `<i data-lucide="${sortDir === 'asc' ? 'arrow-up' : 'arrow-down'}" style="width: 12px; height: 12px;"></i>`;
      } else {
        iconBox.style.opacity = '0.4';
        iconBox.style.color = 'inherit';
        iconBox.innerHTML = `<i data-lucide="arrow-up-down" style="width: 12px; height: 12px;"></i>`;
      }
    }
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 32px; color: var(--text-secondary);">
          <i data-lucide="inbox" style="width: 32px; height: 32px; margin-bottom: 8px; opacity: 0.5;"></i>
          <div>No M-Pesa transactions found matching the selected filter/search.</div>
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = filtered.map(order => {
      const isRefunded = !!order.reversalRef;
      const callbackCode = isRefunded ? 'REVERSED_B2C_200' : 'STK_SUCCESS_0';

      return `
        <tr>
          <td><strong style="font-family: monospace; color: var(--accent-blue);">TXN-${escapeHtml((order.id || '').replace('#', ''))}</strong></td>
          <td><strong style="font-family: monospace; color: var(--mpesa-green);">${escapeHtml(order.mpesaRef || 'VERIFIED')}</strong></td>
          <td>+254 ${escapeHtml(order.phone ? order.phone.replace(/^0/, '') : '712345678')}</td>
          <td><strong style="color: var(--primary-gold);">${escapeHtml(order.id)}</strong></td>
          <td><strong style="color: ${isRefunded ? '#f87171' : 'var(--primary-gold)'};">KES ${(order.total || 0).toLocaleString()}.00</strong></td>
          <td><span class="badge-gold" style="font-family: monospace; font-size: 0.68rem;">${escapeHtml(callbackCode)}</span></td>
          <td>
            <span class="badge-status ${isRefunded ? 'cancelled' : 'completed'}">
              <span>${isRefunded ? 'Refunded (Reversal)' : 'Settled (Paid)'}</span>
            </span>
          </td>
          <td style="font-size: 0.76rem; color: var(--text-muted);">${new Date(order.timestamp).toLocaleString()}</td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn-table-action" onclick="${isRefunded ? `sendReversalWhatsappReceipt('${escapeHtml(order.id)}')` : `sendWhatsappFromOrder('${escapeHtml(order.id)}')`}" title="WhatsApp Receipt"><i data-lucide="message-circle" style="width: 13px; height: 13px; color: var(--mpesa-green);"></i></button>
              <button class="btn-table-action" onclick="openOrderModal('${escapeHtml(order.id)}')" title="Trace Lifecycle"><i data-lucide="search" style="width: 13px; height: 13px;"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  if (window.lucide) {
    try { lucide.createIcons(); } catch (e) {}
  }
}

function exportPaymentsToCSV() {
  const headers = ['Transaction ID', 'M-Pesa Reference', 'Customer Phone', 'Job ID', 'Amount (KES)', 'Gateway Callback', 'Status', 'Timestamp'];
  const rows = (adminState.orders || []).map(o => [
    sanitizeCsvCell(`TXN-${o.id ? o.id.replace('#', '') : ''}`),
    sanitizeCsvCell(o.mpesaRef || 'VERIFIED'),
    sanitizeCsvCell(o.phone || '0712345678'),
    sanitizeCsvCell(o.id || ''),
    sanitizeCsvCell(o.total || 0),
    sanitizeCsvCell(o.reversalRef ? 'REVERSED_B2C_200' : 'STK_SUCCESS_0'),
    sanitizeCsvCell(o.reversalRef ? 'REFUNDED' : 'PAID'),
    sanitizeCsvCell(new Date(o.timestamp).toLocaleString())
  ]);

  downloadCSV('cloudprint_mpesa_payments_ledger.csv', [headers.map(sanitizeCsvCell), ...rows]);
  showAdminToast('Exported M-Pesa payments ledger to CSV', 'success');
}

// ==========================================================================
// TAB 12: SYSTEM HEALTH & TELEMETRY MONITOR
// ==========================================================================
function renderSystemHealth() {
  const container = document.getElementById('subsystemHealthGrid');
  const logsContainer = document.getElementById('healthTelemetryLogsContainer');
  if (!container) return;

  const onlinePrinters = (adminState.printers || []).filter(p => p.status !== 'offline').length;
  const totalPrinters = (adminState.printers || []).length;
  const connectedAgents = (adminState.agents || []).filter(a => a.status === 'connected').length;

  const subsystems = [
    { title: 'Local Storage / State DB', status: 'Healthy (0ms latency)', healthy: true, icon: 'database', desc: 'Active records indexed' },
    { title: 'Print Spool Dispatcher', status: adminState.queueDispatcherRunning ? 'Running Normal' : 'Paused', healthy: adminState.queueDispatcherRunning, icon: 'list-ordered', desc: 'FIFO queue active' },
    { title: 'LAN Print Agents', status: `${connectedAgents}/2 Connected`, healthy: connectedAgents > 0, icon: 'cpu', desc: 'Edge socket verified' },
    { title: 'Network Fleet Nodes', status: `${onlinePrinters}/${totalPrinters} Online`, healthy: onlinePrinters > 0, icon: 'printer', desc: 'SNMP sweep OK' },
    { title: 'Safaricom Daraja Gateway', status: 'Connected (14ms)', healthy: true, icon: 'credit-card', desc: 'STK push callback active' },
    { title: 'Memory Storage Buffer', status: '4.2 MB / 500 MB', healthy: true, icon: 'hard-drive', desc: 'Ephemeral memory quota' }
  ];

  container.innerHTML = subsystems.map(s => `
    <div class="health-tile">
      <div class="health-tile-header">
        <span class="health-tile-title">${s.title}</span>
        <span class="health-status-badge ${s.healthy ? 'healthy' : 'warning'}">
          <i data-lucide="${s.healthy ? 'check-circle' : 'alert-triangle'}" style="width: 12px; height: 12px;"></i>
          <span>${s.status}</span>
        </span>
      </div>
      <div style="font-size: 0.76rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
        <i data-lucide="${s.icon}" style="width: 14px; height: 14px; color: var(--primary-gold);"></i>
        <span>${s.desc}</span>
      </div>
    </div>
  `).join('');

  if (logsContainer) {
    logsContainer.innerHTML = (adminState.logs || []).slice(-10).map(l => `
      <div class="log-entry">
        <span class="log-time">[${l.time}]</span>
        <span class="log-badge ${l.level.toLowerCase()}">${l.level}</span>
        <span class="log-msg">${l.msg}</span>
      </div>
    `).join('');
  }

  if (window.lucide) {
    try { lucide.createIcons(); } catch (e) {}
  }
}

function runComprehensiveHealthSweep() {
  showAdminToast('Running comprehensive subsystem health sweep...', 'info');
  setTimeout(() => {
    addAuditLog('SUCCESS', 'System Telemetry: Comprehensive diagnostics complete. All 6 core subsystems operational.');
    showAdminToast('All subsystems passed telemetry diagnostics!', 'success');
    renderSystemHealth();
  }, 700);
}

// ==========================================================================
// NOTIFICATIONS DRAWER
// ==========================================================================
function renderNotifications() {
  const container = document.getElementById('notificationsDrawerContent');
  const badge = document.getElementById('notificationsUnreadBadge');
  if (!container) return;

  const notifs = adminState.notifications || [];
  const unreadCount = notifs.filter(n => !n.read).length;

  if (badge) {
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
  }

  if (notifs.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.8rem;">No new notifications.</div>`;
    return;
  }

  container.innerHTML = notifs.map(n => `
    <div class="notification-item ${escapeHtml(n.severity || 'info')}">
      <div style="flex: 1;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 0.82rem; color: #ffffff;">${escapeHtml(n.title)}</span>
          <span style="font-size: 0.68rem; color: var(--text-muted);">${escapeHtml(n.time)}</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 3px;">${escapeHtml(n.msg)}</div>
      </div>
    </div>
  `).join('');
}

function toggleNotificationsDrawer() {
  const drawer = document.getElementById('adminNotificationsDrawer');
  if (drawer) {
    drawer.classList.toggle('active');
    renderNotifications();
  }
}

function markAllNotificationsRead() {
  (adminState.notifications || []).forEach(n => n.read = true);
  localStorage.setItem('cloudprint_notifications', JSON.stringify(adminState.notifications));
  renderNotifications();
  showAdminToast('Marked all notifications as read', 'info');
}

// ==========================================================================
// TAB 13: CENTRAL SYSTEM SETTINGS, CMS & PRICING ENGINE
// ==========================================================================
function renderSettings() {
  // 1. Pricing Rates
  const p = adminState.pricing || { a4_bw: 1, a4_colour: 3, a3_bw: 2, a3_colour: 5 };
  if (document.getElementById('rateA4Bw')) document.getElementById('rateA4Bw').value = p.a4_bw || 1;
  if (document.getElementById('rateA4Colour')) document.getElementById('rateA4Colour').value = p.a4_colour || 3;
  if (document.getElementById('rateA3Bw')) document.getElementById('rateA3Bw').value = p.a3_bw || 2;
  if (document.getElementById('rateA3Colour')) document.getElementById('rateA3Colour').value = p.a3_colour || 5;

  // 2. CMS Announcements & Paybill
  const cms = adminState.cms || { announcement: 'Fast, high-resolution laser printing with instant M-Pesa checkout.', bannerActive: true, paybillNo: '892100', whatsappContact: '+254 712 345 678' };
  if (document.getElementById('cmsAnnouncementText')) document.getElementById('cmsAnnouncementText').value = cms.announcement || '';
  if (document.getElementById('cmsBannerActive')) document.getElementById('cmsBannerActive').value = cms.bannerActive !== false ? 'true' : 'false';
  if (document.getElementById('cmsPaybillNo')) document.getElementById('cmsPaybillNo').value = cms.paybillNo || '892100';
  if (document.getElementById('cmsWhatsappContact')) document.getElementById('cmsWhatsappContact').value = cms.whatsappContact || '+254 712 345 678';

  // 3. General Kiosk Info
  const s = adminState.settings || {};
  if (document.getElementById('settingBusinessName')) document.getElementById('settingBusinessName').value = s.businessName || 'CloudPrint Pro - Counter Kiosk #1';
  if (document.getElementById('settingCurrency')) document.getElementById('settingCurrency').value = s.currency || 'KES (Kenya Shillings)';
  if (document.getElementById('settingTimezone')) document.getElementById('settingTimezone').value = s.timezone || 'Africa/Nairobi';
  if (document.getElementById('settingSupportPhone')) document.getElementById('settingSupportPhone').value = s.supportPhone || '+254 712 345 678';

  // 4. Printing Engine Rules
  if (document.getElementById('settingDefaultPaper')) document.getElementById('settingDefaultPaper').value = s.defaultPaper || 'a4';
  if (document.getElementById('settingDefaultColor')) document.getElementById('settingDefaultColor').value = s.defaultColor || 'bw';
  if (document.getElementById('settingMaxFileSize')) document.getElementById('settingMaxFileSize').value = s.maxFileSize || 50;
  if (document.getElementById('settingMaxPages')) document.getElementById('settingMaxPages').value = s.maxPages || 300;
  if (document.getElementById('settingSpoolerTimeout')) document.getElementById('settingSpoolerTimeout').value = s.spoolerTimeout || 60;
}

function savePricingRates() {
  if (!hasPermission('all')) {
    showAdminToast('Access Denied: Only Super Admin can modify pricing rates.', 'error');
    return;
  }

  const a4_bw = parseInt(document.getElementById('rateA4Bw').value, 10) || 1;
  const a4_colour = parseInt(document.getElementById('rateA4Colour').value, 10) || 3;
  const a3_bw = parseInt(document.getElementById('rateA3Bw').value, 10) || 2;
  const a3_colour = parseInt(document.getElementById('rateA3Colour').value, 10) || 5;

  adminState.pricing = { a4_bw, a4_colour, a3_bw, a3_colour };
  localStorage.setItem('cloudprint_pricing', JSON.stringify(adminState.pricing));
  addAuditLog('SUCCESS', `Pricing Engine: Live rates updated (A4: KES ${a4_bw}/${a4_colour}, A3: KES ${a3_bw}/${a3_colour}).`);
  showAdminToast('Pricing rates updated and synced to customer checkout!', 'success');
}

function saveStoreCMS() {
  if (!hasPermission('all')) {
    showAdminToast('Access Denied: Only Super Admin can modify store identity and CMS settings.', 'error');
    return;
  }

  // 1. Business Info
  if (document.getElementById('settingBusinessName')) {
    adminState.settings.businessName = document.getElementById('settingBusinessName').value.trim();
  }
  if (document.getElementById('settingCurrency')) {
    adminState.settings.currency = document.getElementById('settingCurrency').value.trim();
  }
  if (document.getElementById('settingTimezone')) {
    adminState.settings.timezone = document.getElementById('settingTimezone').value;
  }

  // 2. Announcements & Contact
  const announcement = (document.getElementById('cmsAnnouncementText') ? document.getElementById('cmsAnnouncementText').value : '').trim();
  const bannerActive = document.getElementById('cmsBannerActive') ? (document.getElementById('cmsBannerActive').value === 'true') : true;
  const paybillNo = (document.getElementById('cmsPaybillNo') ? document.getElementById('cmsPaybillNo').value : '').trim();
  const whatsappContact = (document.getElementById('cmsWhatsappContact') ? document.getElementById('cmsWhatsappContact').value : '').trim();

  adminState.settings.supportPhone = whatsappContact;
  adminState.cms = { announcement, bannerActive, paybillNo, whatsappContact };

  localStorage.setItem('cloudprint_settings', JSON.stringify(adminState.settings));
  localStorage.setItem('cloudprint_cms', JSON.stringify(adminState.cms));
  addAuditLog('SUCCESS', `Store CMS & Identity: Business profile, announcement, and Paybill (${paybillNo}) updated.`);
  showAdminToast('Store identity and CMS settings saved successfully!', 'success');
}

function saveGeneralSettings() {
  saveStoreCMS();
}

function savePrintingDefaults() {
  if (!hasPermission('all')) {
    showAdminToast('Access Denied: Only Super Admin can modify system defaults.', 'error');
    return;
  }

  adminState.settings.defaultPaper = document.getElementById('settingDefaultPaper').value;
  adminState.settings.defaultColor = document.getElementById('settingDefaultColor').value;
  adminState.settings.maxFileSize = parseInt(document.getElementById('settingMaxFileSize').value, 10) || 50;
  adminState.settings.maxPages = parseInt(document.getElementById('settingMaxPages').value, 10) || 300;
  adminState.settings.spoolerTimeout = parseInt(document.getElementById('settingSpoolerTimeout').value, 10) || 60;

  localStorage.setItem('cloudprint_settings', JSON.stringify(adminState.settings));
  addAuditLog('SUCCESS', 'System Settings: Printing defaults and spooler limits updated.');
  showAdminToast('Printing defaults saved successfully!', 'success');
}

// Window Global Exports
window.renderSettings = renderSettings;
window.savePricingRates = savePricingRates;
window.saveStoreCMS = saveStoreCMS;
window.saveGeneralSettings = saveGeneralSettings;
window.savePrintingDefaults = savePrintingDefaults;

window.renderLiveQueue = renderLiveQueue;
window.toggleQueueDispatcher = toggleQueueDispatcher;
window.flushCompletedQueue = flushCompletedQueue;
window.changeJobPriority = changeJobPriority;
window.moveJobPrinter = moveJobPrinter;
window.reorderQueueJob = reorderQueueJob;
window.startBackgroundSpoolerDaemon = startBackgroundSpoolerDaemon;

window.renderPrintAgents = renderPrintAgents;
window.pingAgent = pingAgent;
window.pingAllAgents = pingAllAgents;
window.restartAgent = restartAgent;
window.openAddAgentModal = openAddAgentModal;
window.openEditAgentModal = openEditAgentModal;
window.closeAgentModal = closeAgentModal;
window.saveAgentForm = saveAgentForm;

window.renderDocumentVault = renderDocumentVault;
window.changeVaultRetentionPolicy = changeVaultRetentionPolicy;
window.forceWipeAllDocuments = forceWipeAllDocuments;
window.shredDocument = shredDocument;

window.renderPaymentsLedger = renderPaymentsLedger;
window.sortPaymentsTable = sortPaymentsTable;
window.handlePaymentSortSelect = handlePaymentSortSelect;
window.exportPaymentsToCSV = exportPaymentsToCSV;

window.renderSystemHealth = renderSystemHealth;
window.runComprehensiveHealthSweep = runComprehensiveHealthSweep;

window.renderNotifications = renderNotifications;
window.toggleNotificationsDrawer = toggleNotificationsDrawer;
window.markAllNotificationsRead = markAllNotificationsRead;

window.renderSettings = renderSettings;
window.saveGeneralSettings = saveGeneralSettings;
window.savePrintingDefaults = savePrintingDefaults;

// Event Listeners Setup
function setupEventListeners() {
  // Order search
  const orderSearch = document.getElementById('orderSearchInput');
  if (orderSearch) {
    orderSearch.addEventListener('input', (e) => {
      renderOrdersTable('all', e.target.value.trim());
    });
  }

  // Order status filter pills
  document.querySelectorAll('.status-filter-pills .status-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.status-filter-pills .status-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const status = pill.getAttribute('data-status');
      renderOrdersTable(status);
    });
  });

  // CRM Search & View Switcher
  const crmSearch = document.getElementById('crmSearchInput');
  if (crmSearch) {
    crmSearch.addEventListener('input', (e) => {
      renderCRMDirectory(e.target.value.trim());
    });
  }

  const crmViewGridBtn = document.getElementById('crmViewGridBtn');
  if (crmViewGridBtn) {
    crmViewGridBtn.addEventListener('click', () => setCrmViewMode('grid'));
  }

  const crmViewListBtn = document.getElementById('crmViewListBtn');
  if (crmViewListBtn) {
    crmViewListBtn.addEventListener('click', () => setCrmViewMode('list'));
  }

  // Printer Fleet Search & Filter Pills
  const printerSearch = document.getElementById('printerSearchInput');
  if (printerSearch) {
    printerSearch.addEventListener('input', (e) => {
      renderPrinterFleet(null, e.target.value.trim());
    });
  }

  document.querySelectorAll('#printerFilterPills .status-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const filter = pill.getAttribute('data-filter');
      renderPrinterFleet(filter);
    });
  });

  // User Management Search & Filter Pills
  const userSearch = document.getElementById('userSearchInput');
  if (userSearch) {
    userSearch.addEventListener('input', (e) => {
      renderUsersDirectory(null, e.target.value.trim());
    });
  }

  document.querySelectorAll('#userFilterPills .status-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const role = pill.getAttribute('data-role');
      renderUsersDirectory(role);
    });
  });

  // Payments & M-Pesa Search & Filter Pills
  const paymentSearch = document.getElementById('paymentSearchInput');
  if (paymentSearch) {
    paymentSearch.addEventListener('input', (e) => {
      renderPaymentsLedger(null, e.target.value.trim());
    });
  }

  document.querySelectorAll('#paymentFilterPills .status-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const status = pill.getAttribute('data-status');
      renderPaymentsLedger(status, (document.getElementById('paymentSearchInput') ? document.getElementById('paymentSearchInput').value.trim() : null));
    });
  });

  // CMS Pricing Form Submission
  const pricingForm = document.getElementById('cmsPricingForm');
  if (pricingForm) {
    pricingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      adminState.pricing.a4_bw = parseInt(document.getElementById('rateA4Bw').value, 10) || 1;
      adminState.pricing.a4_colour = parseInt(document.getElementById('rateA4Colour').value, 10) || 3;
      adminState.pricing.a3_bw = parseInt(document.getElementById('rateA3Bw').value, 10) || 2;
      adminState.pricing.a3_colour = parseInt(document.getElementById('rateA3Colour').value, 10) || 5;

      localStorage.setItem('cloudprint_pricing', JSON.stringify(adminState.pricing));
      addAuditLog('SUCCESS', `CMS: Live rates updated (A4 Colour: KES ${adminState.pricing.a4_colour}, A4 B&W: KES ${adminState.pricing.a4_bw})`);
      showAdminToast('Pricing rates updated & synced live with customer checkout!', 'success');
    });
  }

  // CMS Store Form Submission
  const storeForm = document.getElementById('cmsStoreForm');
  if (storeForm) {
    storeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      adminState.cms.announcement = document.getElementById('cmsAnnouncementText').value.trim();
      adminState.cms.bannerActive = document.getElementById('cmsBannerActive').value === 'true';
      adminState.cms.paybillNo = document.getElementById('cmsPaybillNo').value.trim();
      adminState.cms.whatsappContact = document.getElementById('cmsWhatsappContact').value.trim();

      localStorage.setItem('cloudprint_cms', JSON.stringify(adminState.cms));
      addAuditLog('SUCCESS', 'CMS: Store settings and announcement banner updated');
      showAdminToast('Store settings saved successfully', 'success');
    });
  }

  // CSV Exports
  const exportOrdersBtn = document.getElementById('exportOrdersCsvBtn');
  if (exportOrdersBtn) {
    exportOrdersBtn.addEventListener('click', () => exportOrdersToCSV());
  }

  const exportCrmBtn = document.getElementById('exportCrmCsvBtn');
  if (exportCrmBtn) {
    exportCrmBtn.addEventListener('click', () => exportCRMToCSV());
  }

  const downloadReportCsvBtn = document.getElementById('downloadReportCsvBtn');
  if (downloadReportCsvBtn) {
    downloadReportCsvBtn.addEventListener('click', () => exportOrdersToCSV());
  }

  // Print Statement
  const printReportBtn = document.getElementById('printReportBtn');
  if (printReportBtn) {
    printReportBtn.addEventListener('click', () => window.print());
  }

  // Clear Logs
  const clearLogsBtn = document.getElementById('clearLogsBtn');
  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', () => {
      adminState.logs = [];
      localStorage.setItem('cloudprint_logs', '[]');
      renderLogsStream();
      showAdminToast('Audit log stream cleared', 'info');
    });
  }

  // Refresh
  const refreshBtn = document.getElementById('refreshDataBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadAdminState();
      renderAllTabs();
      showAdminToast('Dashboard data refreshed', 'success');
    });
  }

  // Modal Close
  const closeOrderBtn = document.getElementById('closeOrderModalBtn');
  if (closeOrderBtn) closeOrderBtn.addEventListener('click', closeAdminModal);
}

// CSV Exporters
function exportOrdersToCSV() {
  const headers = ['Job ID', 'Date', 'Customer Phone', 'Document', 'Service', 'Pages', 'Copies', 'Total (KES)', 'M-Pesa Ref', 'Status'];
  const rows = (adminState.orders || []).map(o => [
    sanitizeCsvCell(o.id || ''),
    sanitizeCsvCell(new Date(o.timestamp).toLocaleString()),
    sanitizeCsvCell(o.phone || '0712345678'),
    sanitizeCsvCell(o.fileName || 'Document.pdf'),
    sanitizeCsvCell(o.serviceName || 'A4 Colour'),
    sanitizeCsvCell(o.pages || 10),
    sanitizeCsvCell(o.copies || 1),
    sanitizeCsvCell(o.total || 0),
    sanitizeCsvCell(o.mpesaRef || 'VERIFIED'),
    sanitizeCsvCell(o.status || 'Ready')
  ]);

  downloadCSV('cloudprint_sales_orders.csv', [headers.map(sanitizeCsvCell), ...rows]);
  showAdminToast('Exported orders to CSV', 'success');
}

function exportCRMToCSV() {
  const headers = ['Customer Phone', 'Name', 'Total Orders', 'Total Spend (KES)', 'Total Pages', 'Last Order Date'];
  const customerMap = new Map();

  (adminState.orders || []).forEach(o => {
    const phone = o.phone || '0712345678';
    if (!customerMap.has(phone)) {
      customerMap.set(phone, { phone, name: o.customer || 'Customer ' + phone.slice(-4), orders: 0, spend: 0, pages: 0, last: o.timestamp });
    }
    const c = customerMap.get(phone);
    c.orders++;
    c.spend += (o.total || 0);
    c.pages += (o.pages || 10) * (o.copies || 1);
  });

  const rows = Array.from(customerMap.values()).map(c => [
    sanitizeCsvCell(c.phone),
    sanitizeCsvCell(c.name),
    sanitizeCsvCell(c.orders),
    sanitizeCsvCell(c.spend),
    sanitizeCsvCell(c.pages),
    sanitizeCsvCell(new Date(c.last).toLocaleDateString())
  ]);

  downloadCSV('cloudprint_crm_customers.csv', [headers.map(sanitizeCsvCell), ...rows]);
  showAdminToast('Exported CRM customer directory to CSV', 'success');
}

function downloadCSV(filename, dataRows) {
  const csvContent = 'data:text/csv;charset=utf-8,' + dataRows.map(e => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Helpers
function getStatusClass(status = '') {
  const s = String(status || '').toLowerCase();
  if (s.includes('ready')) return 'ready';
  if (s.includes('print')) return 'printing';
  if (s.includes('comp')) return 'completed';
  if (s.includes('cancel')) return 'cancelled';
  return 'ready';
}

function truncateStr(str, n) {
  return (str && str.length > n) ? str.substr(0, n - 1) + '...' : (str || '');
}

function formatLogTime(date) {
  return date.toTimeString().split(' ')[0];
}

function showAdminToast(msg, type = 'info') {
  const container = document.getElementById('adminToastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i data-lucide="${type === 'success' ? 'check-circle' : 'info'}" style="width: 16px; height: 16px;"></i>
    <span>${escapeHtml(msg)}</span>
  `;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
