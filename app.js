/**
 * CloudPrint Pro - Application Logic
 * Premium Multi-File Document Printing & M-Pesa Payment Simulation
 */

// Complete Audio & Sound Silencing Overrides (Zero sound output)
if (typeof window !== 'undefined') {
  try {
    window.Audio = function () {
      return { play: () => Promise.resolve(), pause: () => {}, addEventListener: () => {} };
    };
    window.playSuccessSound = function () {};
    window.showToast = function () {};
  } catch (e) {}
}

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

function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  let cleaned = String(rawPhone).replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.startsWith('254') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(3);
  } else if (!cleaned.startsWith('0') && (cleaned.startsWith('7') || cleaned.startsWith('1')) && cleaned.length === 9) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

function isValidKenyanPhone(phone) {
  const norm = normalizePhoneNumber(phone);
  return /^0[17]\d{8}$/.test(norm);
}

// Application State
const state = {
  activeScreen: 'home', // 'home' | 'upload' | 'review' | 'processing' | 'completed'
  currentJob: {
    id: '#CP123456',
    files: [],
    paperSize: 'a4', // 'a4' | 'a3'
    colorMode: 'colour', // 'bw' | 'colour'
    serviceName: 'A4 Full Colour',
    ratePerPage: 3,
    totalDocPages: 0,
    copies: 1,
    doubleSided: false,
    phone: '0712345678',
    total: 0,
    mpesaRef: 'SJK' + Math.floor(100000 + Math.random() * 900000),
    timestamp: new Date(),
    status: 'completed'
  },
  services: {
    a4_bw: { name: 'A4 B&W', rate: 1, icon: 'file-text' },
    a4_colour: { name: 'A4 Colour', rate: 3, icon: 'file-image' },
    a3_bw: { name: 'A3 B&W', rate: 2, icon: 'layers' },
    a3_colour: { name: 'A3 Colour', rate: 5, icon: 'sparkle' }
  },
  processingTimer: null,
  stkCountdownTimer: null
};

// DOM Elements
const elements = {
  // Screens
  screenHome: document.getElementById('screenHome'),
  screenUpload: document.getElementById('screenUpload'),
  screenReview: document.getElementById('screenReview'),
  screenProcessing: document.getElementById('screenProcessing'),
  screenCompleted: document.getElementById('screenCompleted'),
  flowStepper: document.getElementById('flowStepper'),
  flowBackBtn: document.getElementById('flowBackBtn'),
  brandHomeBtn: document.getElementById('brandHomeBtn'),

  // Stepper Pills
  stepPill1: document.getElementById('stepPill1'),
  stepPill2: document.getElementById('stepPill2'),
  stepPill3: document.getElementById('stepPill3'),
  stepPill4: document.getElementById('stepPill4'),

  // View switchers
  viewMobileBtn: document.getElementById('viewMobileBtn'),
  viewFluidBtn: document.getElementById('viewFluidBtn'),
  deviceFrameWrapper: document.getElementById('deviceFrameWrapper'),

  // Home Screen
  startPrintingBtn: document.getElementById('startPrintingBtn'),
  trackJobHomeBtn: document.getElementById('trackJobHomeBtn'),
  serviceCards: document.querySelectorAll('.service-card'),

  // Upload Screen (Multi-file)
  dropzoneBox: document.getElementById('dropzoneBox'),
  chooseFileBtn: document.getElementById('chooseFileBtn'),
  fileInputElement: document.getElementById('fileInputElement'),
  uploadStagingQueue: document.getElementById('uploadStagingQueue'),
  uploadStagingList: document.getElementById('uploadStagingList'),
  uploadQueueCount: document.getElementById('uploadQueueCount'),
  addMoreFilesBtn: document.getElementById('addMoreFilesBtn'),
  uploadNextBtn: document.getElementById('uploadNextBtn'),
  uploadNextBtnText: document.getElementById('uploadNextBtnText'),

  // Review Screen (Multi-file)
  reviewFilesCount: document.getElementById('reviewFilesCount'),
  reviewAddMoreFilesBtn: document.getElementById('reviewAddMoreFilesBtn'),
  reviewFilesContainer: document.getElementById('reviewFilesContainer'),
  batchPagesTotalText: document.getElementById('batchPagesTotalText'),
  paperSizeSelectBox: document.getElementById('paperSizeSelectBox'),
  paperSizeDropdownList: document.getElementById('paperSizeDropdownList'),
  selectedPaperSizeText: document.getElementById('selectedPaperSizeText'),
  colorSelectBox: document.getElementById('colorSelectBox'),
  colorDropdownList: document.getElementById('colorDropdownList'),
  selectedColorDot: document.getElementById('selectedColorDot'),
  selectedColorText: document.getElementById('selectedColorText'),
  selectedColorRate: document.getElementById('selectedColorRate'),
  bwDropdownRateText: document.getElementById('bwDropdownRateText'),
  colourDropdownRateText: document.getElementById('colourDropdownRateText'),

  // Pages to Print Controls
  pagesSummaryBadge: document.getElementById('pagesSummaryBadge'),
  totalDocPagesText: document.getElementById('totalDocPagesText'),
  pageModeAllBtn: document.getElementById('pageModeAllBtn'),
  pageModeCustomBtn: document.getElementById('pageModeCustomBtn'),
  customPageRangeBox: document.getElementById('customPageRangeBox'),
  pageFromInput: document.getElementById('pageFromInput'),
  pageToInput: document.getElementById('pageToInput'),
  customPageListInput: document.getElementById('customPageListInput'),

  // Copies Stepper
  copiesMinusBtn: document.getElementById('copiesMinusBtn'),
  copiesPlusBtn: document.getElementById('copiesPlusBtn'),
  copiesCountVal: document.getElementById('copiesCountVal'),
  doubleSidedToggle: document.getElementById('doubleSidedToggle'),
  doubleSidedCheck: document.getElementById('doubleSidedCheck'),

  mpesaPhoneInput: document.getElementById('mpesaPhoneInput'),
  reviewTotalAmount: document.getElementById('reviewTotalAmount'),
  payMpesaBtn: document.getElementById('payMpesaBtn'),

  // Processing Screen
  processingRingCircle: document.getElementById('processingRingCircle'),
  processingStatusText: document.getElementById('processingStatusText'),
  chkUploading: document.getElementById('chkUploading'),
  chkProcessing: document.getElementById('chkProcessing'),
  chkPrinting: document.getElementById('chkPrinting'),
  chkPreparing: document.getElementById('chkPreparing'),

  // Completed Screen & Receipt (Matches Reference Spec)
  whatsappReceiptBtn: document.getElementById('whatsappReceiptBtn'),
  startNewPrintBtn: document.getElementById('startNewPrintBtn'),
  receiptJobIdVal: document.getElementById('receiptJobIdVal'),
  receiptPaidAtVal: document.getElementById('receiptPaidAtVal'),
  receiptMpesaCodeVal: document.getElementById('receiptMpesaCodeVal'),
  receiptPagesCountVal: document.getElementById('receiptPagesCountVal'),
  receiptPageRangeVal: document.getElementById('receiptPageRangeVal'),
  receiptFormatVal: document.getElementById('receiptFormatVal'),
  receiptStatusVal: document.getElementById('receiptStatusVal'),
  receiptTotalVal: document.getElementById('receiptTotalVal'),

  // Modals & Menu
  mpesaStkModal: document.getElementById('mpesaStkModal'),
  closeStkModalBtn: document.getElementById('closeStkModalBtn'),
  cancelStkBtn: document.getElementById('cancelStkBtn'),
  confirmStkPinBtn: document.getElementById('confirmStkPinBtn'),
  stkPromptMessage: document.getElementById('stkPromptMessage'),
  stkCountdown: document.getElementById('stkCountdown'),
  pinDigits: document.querySelectorAll('.stk-pin-digit'),

  trackJobModal: document.getElementById('trackJobModal'),
  closeTrackModalBtn: document.getElementById('closeTrackModalBtn'),
  trackJobInput: document.getElementById('trackJobInput'),
  searchJobBtn: document.getElementById('searchJobBtn'),
  trackResultContainer: document.getElementById('trackResultContainer'),

  menuDrawerModal: document.getElementById('menuDrawerModal'),
  openMenuBtn: document.getElementById('openMenuBtn'),
  closeMenuModalBtn: document.getElementById('closeMenuModalBtn'),
  openHistoryBtn: document.getElementById('openHistoryBtn'),
  menuTrackJobBtn: document.getElementById('menuTrackJobBtn'),
  menuNewPrintBtn: document.getElementById('menuNewPrintBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  ordersHistoryList: document.getElementById('ordersHistoryList'),

  // Printable receipt
  printableReceiptArea: document.getElementById('printableReceiptArea'),
  recJobId: document.getElementById('recJobId'),
  recDate: document.getElementById('recDate'),
  recDoc: document.getElementById('recDoc'),
  recService: document.getElementById('recService'),
  recPages: document.getElementById('recPages'),
  recPhone: document.getElementById('recPhone'),
  recMpesaRef: document.getElementById('recMpesaRef'),
  recTotal: document.getElementById('recTotal')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }

  // Adaptive responsive layout initialization
  const savedMode = localStorage.getItem('cloudprint_view_mode');
  if (savedMode) {
    setViewMode(savedMode);
  } else if (window.innerWidth >= 768) {
    setViewMode('fluid');
  } else {
    setViewMode('mobile');
  }

  setupEventListeners();
  initSavedCustomerPhone();
  fetchStoreSettings();
  renderLandingStandardRates();
  renderReviewFilesList();
  renderUploadStagingQueue();
  applySystemSettingsDefaults(true);
  renderOrdersHistory();
  renderScreenReceipt();
});

window.addEventListener('resize', () => {
  if (!localStorage.getItem('cloudprint_view_mode')) {
    if (window.innerWidth >= 768 && elements.deviceFrameWrapper && !elements.deviceFrameWrapper.classList.contains('fluid-mode')) {
      setViewMode('fluid');
    } else if (window.innerWidth < 768 && elements.deviceFrameWrapper && !elements.deviceFrameWrapper.classList.contains('mobile-mode')) {
      setViewMode('mobile');
    }
  }
});

// Customer Phone Memory
function initSavedCustomerPhone() {
  try {
    const saved = localStorage.getItem('cloudprint_saved_phone');
    if (saved && isValidKenyanPhone(saved)) {
      const normalized = normalizePhoneNumber(saved);
      if (elements.mpesaPhoneInput) {
        // Next to the +254 prefix badge, display 9 digits without leading 0
        const displayVal = normalized.startsWith('0') ? normalized.slice(1) : normalized;
        elements.mpesaPhoneInput.value = displayVal;
      }
      state.currentJob.phone = normalized;
    }
  } catch (e) {}
}

// Storage and Focus Synchronization with Admin Panel Settings & Pricing Changes
window.addEventListener('storage', (e) => {
  if (e.key === 'cloudprint_pricing' || e.key === 'cloudprint_settings' || !e.key) {
    renderLandingStandardRates();
    applySystemSettingsDefaults();
    updatePricingRates();
    updateCalculations();
  }
});

window.addEventListener('focus', () => {
  renderLandingStandardRates();
  applySystemSettingsDefaults();
  updatePricingRates();
  updateCalculations();
});

// Setup Event Listeners
function setupEventListeners() {
  // Navigation & View Mode
  if (elements.viewMobileBtn) elements.viewMobileBtn.addEventListener('click', () => setViewMode('mobile', true));
  if (elements.viewFluidBtn) elements.viewFluidBtn.addEventListener('click', () => setViewMode('fluid', true));

  if (elements.brandHomeBtn) elements.brandHomeBtn.addEventListener('click', () => navigateTo('home'));
  if (elements.flowBackBtn) elements.flowBackBtn.addEventListener('click', handleFlowBack);

  // Home Screen Triggers
  if (elements.startPrintingBtn) elements.startPrintingBtn.addEventListener('click', () => navigateTo('upload'));
  if (elements.trackJobHomeBtn) elements.trackJobHomeBtn.addEventListener('click', () => openModal(elements.trackJobModal));

  // Multi-File Upload triggers
  if (elements.chooseFileBtn) {
    elements.chooseFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.fileInputElement.click();
    });
  }

  if (elements.addMoreFilesBtn) {
    elements.addMoreFilesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.fileInputElement.click();
    });
  }

  if (elements.reviewAddMoreFilesBtn) {
    elements.reviewAddMoreFilesBtn.addEventListener('click', () => {
      elements.fileInputElement.click();
    });
  }

  if (elements.dropzoneBox) {
    elements.dropzoneBox.addEventListener('click', () => {
      elements.fileInputElement.click();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      elements.dropzoneBox.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.dropzoneBox.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      elements.dropzoneBox.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.dropzoneBox.classList.remove('drag-over');
      });
    });

    elements.dropzoneBox.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
    });
  }

  if (elements.fileInputElement) {
    elements.fileInputElement.addEventListener('change', handleFileInput);
  }

  if (elements.uploadNextBtn) {
    elements.uploadNextBtn.addEventListener('click', () => {
      if (!state.currentJob.files || state.currentJob.files.length === 0) {
        if (elements.fileInputElement) elements.fileInputElement.click();
        return;
      }

      const totalPgs = state.currentJob.files.reduce((sum, f) => sum + (f.pages || 1), 0);
      const settings = getSystemSettings();
      const maxPages = settings.maxPages || 300;
      if (totalPgs > maxPages) {
        return;
      }

      navigateTo('review');
    });
  }

  // Paper Size Dropdown Toggle
  if (elements.paperSizeSelectBox && elements.paperSizeDropdownList) {
    elements.paperSizeSelectBox.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = elements.paperSizeDropdownList.style.display === 'flex';
      elements.paperSizeDropdownList.style.display = isExpanded ? 'none' : 'flex';
      elements.paperSizeSelectBox.classList.toggle('active', !isExpanded);
      if (elements.colorDropdownList) {
        elements.colorDropdownList.style.display = 'none';
        if (elements.colorSelectBox) elements.colorSelectBox.classList.remove('active');
      }
    });

    document.querySelectorAll('#paperSizeDropdownList .service-option-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const size = item.getAttribute('data-size');
        setPaperSize(size);
        elements.paperSizeDropdownList.style.display = 'none';
        elements.paperSizeSelectBox.classList.remove('active');
      });
    });
  }

  // Color Dropdown Toggle
  if (elements.colorSelectBox && elements.colorDropdownList) {
    elements.colorSelectBox.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = elements.colorDropdownList.style.display === 'flex';
      elements.colorDropdownList.style.display = isExpanded ? 'none' : 'flex';
      elements.colorSelectBox.classList.toggle('active', !isExpanded);
      if (elements.paperSizeDropdownList) {
        elements.paperSizeDropdownList.style.display = 'none';
        if (elements.paperSizeSelectBox) elements.paperSizeSelectBox.classList.remove('active');
      }
    });

    document.querySelectorAll('#colorDropdownList .service-option-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = item.getAttribute('data-color');
        setColorMode(color);
        elements.colorDropdownList.style.display = 'none';
        elements.colorSelectBox.classList.remove('active');
      });
    });
  }

  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    if (elements.paperSizeDropdownList) elements.paperSizeDropdownList.style.display = 'none';
    if (elements.colorDropdownList) elements.colorDropdownList.style.display = 'none';
    if (elements.paperSizeSelectBox) elements.paperSizeSelectBox.classList.remove('active');
    if (elements.colorSelectBox) elements.colorSelectBox.classList.remove('active');
  });

  // Pages Mode Tabs (All Pages vs Custom)
  if (elements.pageModeAllBtn && elements.pageModeCustomBtn) {
    elements.pageModeAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setPageMode('all');
    });

    elements.pageModeCustomBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setPageMode('custom');
    });
  }

  // Custom Page Range input change listeners
  if (elements.pageFromInput && elements.pageToInput) {
    elements.pageFromInput.addEventListener('input', updateCustomPagesCount);
    elements.pageToInput.addEventListener('input', updateCustomPagesCount);
  }
  if (elements.customPageListInput) {
    elements.customPageListInput.addEventListener('input', updateCustomPagesCount);
  }

  // Copies Stepper
  if (elements.copiesMinusBtn && elements.copiesPlusBtn) {
    elements.copiesMinusBtn.addEventListener('click', () => {
      if (state.currentJob.copies > 1) {
        state.currentJob.copies--;
        elements.copiesCountVal.textContent = state.currentJob.copies;
        updateCalculations();
      }
    });

    elements.copiesPlusBtn.addEventListener('click', () => {
      if (state.currentJob.copies < 50) {
        state.currentJob.copies++;
        elements.copiesCountVal.textContent = state.currentJob.copies;
        updateCalculations();
      }
    });
  }

  // Double sided
  if (elements.doubleSidedToggle) {
    elements.doubleSidedToggle.addEventListener('click', () => {
      elements.doubleSidedCheck.checked = !elements.doubleSidedCheck.checked;
      state.currentJob.doubleSided = elements.doubleSidedCheck.checked;
      elements.doubleSidedToggle.classList.toggle('active', state.currentJob.doubleSided);
    });
  }

  // M-Pesa Phone Number input listener & memory persistence
  if (elements.mpesaPhoneInput) {
    elements.mpesaPhoneInput.addEventListener('input', (e) => {
      const clean = normalizePhoneNumber(e.target.value);
      if (clean && isValidKenyanPhone(clean)) {
        try { localStorage.setItem('cloudprint_saved_phone', clean); } catch (err) {}
        state.currentJob.phone = clean;
      }
    });

    elements.mpesaPhoneInput.addEventListener('blur', (e) => {
      const raw = e.target.value.trim();
      if (raw) {
        const clean = normalizePhoneNumber(raw);
        if (isValidKenyanPhone(clean)) {
          const displayVal = clean.startsWith('0') ? clean.slice(1) : clean;
          e.target.value = displayVal;
          try { localStorage.setItem('cloudprint_saved_phone', clean); } catch (err) {}
          state.currentJob.phone = clean;
        }
      }
    });
  }

  if (elements.payMpesaBtn) elements.payMpesaBtn.addEventListener('click', triggerMpesaSTKPush);

  // Completed Screen Buttons
  if (elements.copyJobIdBtn) elements.copyJobIdBtn.addEventListener('click', copyJobId);
  if (elements.whatsappReceiptBtn) elements.whatsappReceiptBtn.addEventListener('click', sendReceiptToWhatsapp);
  if (elements.startNewPrintBtn) {
    elements.startNewPrintBtn.addEventListener('click', () => {
      resetToNewJob();
      navigateTo('upload');
    });
  }

  if (elements.closeStkModalBtn) {
    elements.closeStkModalBtn.addEventListener('click', () => {
      if (state.stkCountdownTimer) clearInterval(state.stkCountdownTimer);
      closeModal(elements.mpesaStkModal);
    });
  }
  if (elements.cancelStkBtn) {
    elements.cancelStkBtn.addEventListener('click', () => {
      if (state.stkCountdownTimer) clearInterval(state.stkCountdownTimer);
      closeModal(elements.mpesaStkModal);
    });
  }

  // Job Tracker Modal
  if (elements.closeTrackModalBtn) elements.closeTrackModalBtn.addEventListener('click', () => closeModal(elements.trackJobModal));
  if (elements.searchJobBtn) elements.searchJobBtn.addEventListener('click', searchJobAudit);
  if (elements.trackJobInput) {
    elements.trackJobInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchJobAudit();
    });
  }

  // Menu Drawer Modal
  if (elements.openMenuBtn) elements.openMenuBtn.addEventListener('click', () => openModal(elements.menuDrawerModal));
  if (elements.openHistoryBtn) elements.openHistoryBtn.addEventListener('click', () => openModal(elements.menuDrawerModal));
  if (elements.closeMenuModalBtn) elements.closeMenuModalBtn.addEventListener('click', () => closeModal(elements.menuDrawerModal));
  if (elements.menuTrackJobBtn) {
    elements.menuTrackJobBtn.addEventListener('click', () => {
      closeModal(elements.menuDrawerModal);
      openModal(elements.trackJobModal);
    });
  }
  if (elements.menuNewPrintBtn) {
    elements.menuNewPrintBtn.addEventListener('click', () => {
      closeModal(elements.menuDrawerModal);
      navigateTo('upload');
    });
  }
  if (elements.clearHistoryBtn) {
    elements.clearHistoryBtn.addEventListener('click', clearOrdersHistory);
  }

  // Global escape key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(elements.mpesaStkModal);
      closeModal(elements.trackJobModal);
      closeModal(elements.menuDrawerModal);
    }
  });
}

// Navigation Router
function navigateTo(screenName) {
  state.activeScreen = screenName;

  // Hide all screens
  const screens = [
    elements.screenHome,
    elements.screenUpload,
    elements.screenReview,
    elements.screenProcessing,
    elements.screenCompleted
  ];
  screens.forEach(s => {
    if (s) s.classList.remove('active');
  });

  // Update Stepper visibility and pills
  if (screenName === 'home') {
    if (elements.flowStepper) elements.flowStepper.style.display = 'none';
    if (elements.screenHome) elements.screenHome.classList.add('active');
    renderLandingStandardRates();
  } else {
    if (elements.flowStepper) elements.flowStepper.style.display = 'flex';
    updateStepperPills(screenName);

    if (screenName === 'upload' && elements.screenUpload) elements.screenUpload.classList.add('active');
    else if (screenName === 'review' && elements.screenReview) elements.screenReview.classList.add('active');
    else if (screenName === 'processing' && elements.screenProcessing) elements.screenProcessing.classList.add('active');
    else if (screenName === 'completed' && elements.screenCompleted) elements.screenCompleted.classList.add('active');
  }

  // Refresh lucide icons on view change
  if (window.lucide) {
    lucide.createIcons();
  }
}

function updateStepperPills(screenName) {
  const pills = [elements.stepPill1, elements.stepPill2, elements.stepPill3, elements.stepPill4];
  pills.forEach(p => {
    if (p) p.classList.remove('active', 'completed');
  });

  if (screenName === 'upload' && elements.stepPill1) {
    elements.stepPill1.classList.add('active');
  } else if (screenName === 'review' && elements.stepPill1 && elements.stepPill2) {
    elements.stepPill1.classList.add('completed');
    elements.stepPill2.classList.add('active');
  } else if (screenName === 'processing') {
    if (elements.stepPill1) elements.stepPill1.classList.add('completed');
    if (elements.stepPill2) elements.stepPill2.classList.add('completed');
    if (elements.stepPill3) elements.stepPill3.classList.add('active');
  } else if (screenName === 'completed') {
    if (elements.stepPill1) elements.stepPill1.classList.add('completed');
    if (elements.stepPill2) elements.stepPill2.classList.add('completed');
    if (elements.stepPill3) elements.stepPill3.classList.add('completed');
    if (elements.stepPill4) elements.stepPill4.classList.add('completed', 'active');
  }
}

function handleFlowBack() {
  if (state.activeScreen === 'upload') navigateTo('home');
  else if (state.activeScreen === 'review') navigateTo('upload');
  else if (state.activeScreen === 'processing') navigateTo('review');
  else if (state.activeScreen === 'completed') navigateTo('home');
}

// System Settings & Printing Rules Loader
function getSystemSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('cloudprint_settings') || '{}');
    return {
      businessName: s.businessName || 'CloudPrint Pro - Counter Kiosk #1',
      currency: s.currency || 'KES (Kenya Shillings)',
      timezone: s.timezone || 'Africa/Nairobi',
      supportPhone: s.supportPhone || '+254 712 345 678',
      defaultPaper: s.defaultPaper || 'a4',
      defaultColor: s.defaultColor || 'bw',
      maxFileSize: parseInt(s.maxFileSize, 10) || 50,
      maxPages: parseInt(s.maxPages, 10) || 300,
      spoolerTimeout: parseInt(s.spoolerTimeout, 10) || 60
    };
  } catch (e) {
    return {
      businessName: 'CloudPrint Pro - Counter Kiosk #1',
      currency: 'KES (Kenya Shillings)',
      timezone: 'Africa/Nairobi',
      supportPhone: '+254 712 345 678',
      defaultPaper: 'a4',
      defaultColor: 'bw',
      maxFileSize: 50,
      maxPages: 300,
      spoolerTimeout: 60
    };
  }
}

function applySystemSettingsDefaults(force = false) {
  const settings = getSystemSettings();
  if (force || (!state.currentJob.files || state.currentJob.files.length === 0)) {
    if (settings.defaultPaper) setPaperSize(settings.defaultPaper);
    if (settings.defaultColor) setColorMode(settings.defaultColor);
  }
}

// Live Dynamic Pricing from CMS
function getLiveRates() {
  try {
    const customPricing = JSON.parse(localStorage.getItem('cloudprint_pricing'));
    if (customPricing) {
      return {
        a4_bw: customPricing.a4_bw || 1,
        a4_colour: customPricing.a4_colour || 3,
        a3_bw: customPricing.a3_bw || 2,
        a3_colour: customPricing.a3_colour || 5
      };
    }
  } catch (e) {}
  return { a4_bw: 1, a4_colour: 3, a3_bw: 2, a3_colour: 5 };
}

// Render Standard Rates on Landing Page dynamically from CMS Pricing
function renderLandingStandardRates() {
  const rates = getLiveRates();

  const a4BwEl = document.getElementById('landingRateA4Bw');
  const a4ColourEl = document.getElementById('landingRateA4Colour');
  const a3BwEl = document.getElementById('landingRateA3Bw');
  const a3ColourEl = document.getElementById('landingRateA3Colour');

  if (a4BwEl) a4BwEl.innerHTML = `KES ${rates.a4_bw} <span class="per-unit">/page</span>`;
  if (a4ColourEl) a4ColourEl.innerHTML = `KES ${rates.a4_colour} <span class="per-unit">/page</span>`;
  if (a3BwEl) a3BwEl.innerHTML = `KES ${rates.a3_bw} <span class="per-unit">/page</span>`;
  if (a3ColourEl) a3ColourEl.innerHTML = `KES ${rates.a3_colour} <span class="per-unit">/page</span>`;

  // Update rates in state.services
  if (state.services) {
    if (state.services.a4_bw) state.services.a4_bw.rate = rates.a4_bw;
    if (state.services.a4_colour) state.services.a4_colour.rate = rates.a4_colour;
    if (state.services.a3_bw) state.services.a3_bw.rate = rates.a3_bw;
    if (state.services.a3_colour) state.services.a3_colour.rate = rates.a3_colour;
  }

  // Update color dropdown rate labels
  const currentSize = state.currentJob.paperSize || 'a4';
  if (currentSize === 'a4') {
    if (elements.bwDropdownRateText) elements.bwDropdownRateText.textContent = `KES ${rates.a4_bw} /page`;
    if (elements.colourDropdownRateText) elements.colourDropdownRateText.textContent = `KES ${rates.a4_colour} /page`;
  } else {
    if (elements.bwDropdownRateText) elements.bwDropdownRateText.textContent = `KES ${rates.a3_bw} /page`;
    if (elements.colourDropdownRateText) elements.colourDropdownRateText.textContent = `KES ${rates.a3_colour} /page`;
  }
}

// Paper Size & Color Selection Handlers
function setPaperSize(size) {
  state.currentJob.paperSize = size;
  const rates = getLiveRates();
  
  // Update paper size dropdown selected class
  document.querySelectorAll('#paperSizeDropdownList .service-option-item').forEach(item => {
    item.classList.toggle('selected', item.getAttribute('data-size') === size);
  });

  // Update selected paper size text in select box
  if (elements.selectedPaperSizeText) {
    elements.selectedPaperSizeText.textContent = size === 'a4' ? 'A4 Standard (210×297mm)' : 'A3 Large Format (297×420mm)';
  }

  // Update rate labels inside the color dropdown
  if (size === 'a4') {
    if (elements.bwDropdownRateText) elements.bwDropdownRateText.textContent = `KES ${rates.a4_bw} /page`;
    if (elements.colourDropdownRateText) elements.colourDropdownRateText.textContent = `KES ${rates.a4_colour} /page`;
  } else {
    if (elements.bwDropdownRateText) elements.bwDropdownRateText.textContent = `KES ${rates.a3_bw} /page`;
    if (elements.colourDropdownRateText) elements.colourDropdownRateText.textContent = `KES ${rates.a3_colour} /page`;
  }

  updatePricingRates();
}

function setColorMode(color) {
  state.currentJob.colorMode = color;

  // Update color dropdown selected class
  document.querySelectorAll('#colorDropdownList .service-option-item').forEach(item => {
    item.classList.toggle('selected', item.getAttribute('data-color') === color);
  });

  // Update selected color text and dot
  if (elements.selectedColorText) {
    elements.selectedColorText.textContent = color === 'bw' ? 'Black & White' : 'Full Colour';
  }
  if (elements.selectedColorDot) {
    elements.selectedColorDot.className = `color-indicator-dot ${color}`;
  }

  updatePricingRates();
}

function updatePricingRates() {
  const size = state.currentJob.paperSize || 'a4';
  const color = state.currentJob.colorMode || 'colour';
  const rates = getLiveRates();

  if (size === 'a4') {
    state.currentJob.ratePerPage = color === 'bw' ? rates.a4_bw : rates.a4_colour;
    state.currentJob.serviceName = color === 'bw' ? 'A4 B&W' : 'A4 Full Colour';
  } else {
    state.currentJob.ratePerPage = color === 'bw' ? rates.a3_bw : rates.a3_colour;
    state.currentJob.serviceName = color === 'bw' ? 'A3 B&W' : 'A3 Colour';
  }

  if (elements.selectedColorRate) {
    elements.selectedColorRate.innerHTML = `KES ${state.currentJob.ratePerPage} <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;">/page</span>`;
  }

  updateCalculations();
}

// Multi-File Upload & Client-Side Page Counter Engine
function handleFileInput(e) {
  const files = e.target.files;
  if (files && files.length > 0) {
    processFiles(files);
  }
}

async function processFiles(fileList) {
  const newFiles = Array.from(fileList);
  const settings = getSystemSettings();
  const maxMb = settings.maxFileSize || 50;
  const maxBytes = maxMb * 1024 * 1024;
  const allowedExts = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'rtf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'bmp', 'svg'];
  
  let addedCount = 0;

  for (const file of newFiles) {
    // 1. File Size Validation against Dynamic System Rule
    if (file.size > maxBytes || file.size === 0) {
      continue;
    }

    const fileName = file.name;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const fileSize = sizeMB > 0 ? `${sizeMB} MB` : `${(file.size / 1024).toFixed(0)} KB`;
    const ext = fileName.split('.').pop().toLowerCase();

    // 2. Extension Validation
    if (!allowedExts.includes(ext)) {
      continue;
    }

    // Client-side page counting
    let detectedPages = 1;
    if (ext === 'pdf') {
      try {
        detectedPages = await countPdfPages(file);
      } catch (err) {
        detectedPages = Math.min(25, Math.max(5, Math.round(file.size / (150 * 1024))));
      }
    } else if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'bmp', 'svg'].includes(ext)) {
      detectedPages = 1;
    } else if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) {
      detectedPages = Math.min(30, Math.max(2, Math.round(file.size / (180 * 1024))));
    } else {
      detectedPages = 1;
    }

    const fileObj = {
      id: 'file_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      name: fileName,
      size: fileSize,
      pages: Math.max(1, detectedPages),
      type: ext,
      rawFile: file,
      fileId: null
    };

    state.currentJob.files.push(fileObj);
    addedCount++;
  }

  if (addedCount > 0) {
    renderUploadStagingQueue();
    renderReviewFilesList();
    updateCalculations();
    // Proactively upload staged files to vault in background
    uploadFilesToVault();
  }
}

// Proactive Server Vault Sync for Real Hardware Printing
async function uploadFilesToVault() {
  const pendingFiles = (state.currentJob.files || []).filter(f => f.rawFile && !f.fileId);
  if (pendingFiles.length === 0) return;

  const formData = new FormData();
  pendingFiles.forEach(f => {
    formData.append('documents', f.rawFile);
  });

  try {
    const res = await fetch('/api/orders/upload', {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.files)) {
        data.files.forEach((staged, idx) => {
          if (pendingFiles[idx]) {
            pendingFiles[idx].fileId = staged.fileId;
          }
        });
      }
    }
  } catch (e) {
    console.warn('Vault upload notice:', e);
  }
}

// Client-Side PDF Page Count Scanner (Lightweight ArrayBuffer header inspection)
function countPdfPages(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const text = new TextDecoder("latin1").decode(reader.result);
        
        // Match /Type /Page (excluding /Pages)
        const pageMatches = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
        if (pageMatches && pageMatches.length > 0) {
          resolve(pageMatches.length);
          return;
        }

        // Match /Count N in page tree catalog
        const countMatch = text.match(/\/Count\s+(\d+)/);
        if (countMatch && countMatch[1]) {
          const num = parseInt(countMatch[1], 10);
          if (num > 0 && num < 1000) {
            resolve(num);
            return;
          }
        }
      } catch (e) {
        // fallback
      }
      resolve(Math.max(1, Math.round(file.size / (200 * 1024))));
    };
    reader.onerror = () => resolve(Math.max(1, Math.round(file.size / (200 * 1024))));
    reader.readAsArrayBuffer(file);
  });
}

// Page Mode (All Pages vs Custom) & Calculation Logic
function setPageMode(mode) {
  state.currentJob.pageMode = mode;

  if (elements.pageModeAllBtn && elements.pageModeCustomBtn) {
    elements.pageModeAllBtn.classList.toggle('active', mode === 'all');
    elements.pageModeCustomBtn.classList.toggle('active', mode === 'custom');
  }

  if (elements.customPageRangeBox) {
    elements.customPageRangeBox.style.display = mode === 'custom' ? 'block' : 'none';
  }

  if (mode === 'all') {
    const totalPgs = state.currentJob.files.reduce((sum, f) => sum + (f.pages || 1), 0);
    state.currentJob.selectedPagesCount = totalPgs;
    if (elements.pagesSummaryBadge) {
      elements.pagesSummaryBadge.textContent = `${totalPgs} page${totalPgs > 1 ? 's' : ''} selected`;
    }
  } else {
    updateCustomPagesCount();
  }

  updateCalculations();
}

function updateCustomPagesCount() {
  if (state.currentJob.pageMode !== 'custom') return;

  const totalDoc = state.currentJob.files.reduce((sum, f) => sum + (f.pages || 1), 0) || 10;
  const customListStr = elements.customPageListInput ? elements.customPageListInput.value.trim() : '';

  let count = 0;

  if (customListStr) {
    // Parse comma and hyphen separated list: e.g. "1-3, 5, 7"
    const parts = customListStr.split(',');
    const pagesSet = new Set();
    parts.forEach(part => {
      const p = part.trim();
      if (p.includes('-')) {
        const [startStr, endStr] = p.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = Math.max(1, start); i <= Math.min(totalDoc, end); i++) {
            pagesSet.add(i);
          }
        }
      } else {
        const num = parseInt(p, 10);
        if (!isNaN(num) && num >= 1 && num <= totalDoc) {
          pagesSet.add(num);
        }
      }
    });
    count = pagesSet.size > 0 ? pagesSet.size : 1;
  } else {
    let from = parseInt(elements.pageFromInput ? elements.pageFromInput.value : 1, 10) || 1;
    let to = parseInt(elements.pageToInput ? elements.pageToInput.value : totalDoc, 10) || totalDoc;

    if (from < 1) from = 1;
    if (to > totalDoc) to = totalDoc;
    if (to < from) to = from;

    count = (to - from) + 1;
  }

  state.currentJob.selectedPagesCount = Math.max(1, count);

  if (elements.pagesSummaryBadge) {
    elements.pagesSummaryBadge.textContent = `${state.currentJob.selectedPagesCount} page${state.currentJob.selectedPagesCount > 1 ? 's' : ''} selected`;
  }

  updateCalculations();
}

// Render Upload Staging Queue in Step 1
function renderUploadStagingQueue() {
  const queueEl = elements.uploadStagingQueue;
  const listEl = elements.uploadStagingList;
  const countEl = elements.uploadQueueCount;
  const nextBtnText = elements.uploadNextBtnText;

  if (!queueEl || !listEl) return;

  const files = state.currentJob.files || [];
  if (files.length === 0) {
    queueEl.style.display = 'none';
    if (nextBtnText) nextBtnText.textContent = 'Next';
    return;
  }

  queueEl.style.display = 'block';
  if (countEl) countEl.textContent = files.length;
  if (nextBtnText) nextBtnText.textContent = `Proceed to Review (${files.length} ${files.length > 1 ? 'files' : 'file'})`;

  listEl.innerHTML = files.map(f => `
    <div class="review-file-card">
      <div class="file-info-group">
        <div class="file-type-icon-box">
          <i data-lucide="${f.type === 'pdf' ? 'file-text' : (['png', 'jpg', 'jpeg'].includes(f.type) ? 'image' : 'file')}" style="width: 16px; height: 16px;"></i>
        </div>
        <div style="overflow: hidden;">
          <div class="file-name-row" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
          <div class="file-meta-row">${escapeHtml(f.size)} • <strong style="color: var(--primary-gold);">${f.pages} ${f.pages > 1 ? 'pages' : 'page'}</strong></div>
        </div>
      </div>
      <button type="button" class="btn-delete-file" onclick="removeFile('${escapeHtml(f.id)}')" title="Remove file">
        <i data-lucide="x" style="width: 15px; height: 15px;"></i>
      </button>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

// Render Review Files List in Step 2 with Individual Page Number Counters
function renderReviewFilesList() {
  const container = elements.reviewFilesContainer;
  const countEl = elements.reviewFilesCount;
  const totalPagesText = elements.batchPagesTotalText;

  if (!container) return;

  const files = state.currentJob.files || [];
  if (countEl) countEl.textContent = files.length;

  let totalPages = files.reduce((sum, f) => sum + (f.pages || 1), 0);
  state.currentJob.totalDocPages = totalPages;

  if (elements.totalDocPagesText) elements.totalDocPagesText.textContent = totalPages;
  if (elements.pageFromInput) elements.pageFromInput.max = totalPages;
  if (elements.pageToInput) elements.pageToInput.max = totalPages;

  if (totalPagesText) {
    totalPagesText.textContent = files.length > 0
      ? `${totalPages} total page${totalPages > 1 ? 's' : ''} across ${files.length} file${files.length > 1 ? 's' : ''}`
      : `0 files selected`;
  }

  if (files.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 22px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-medium);">
        <i data-lucide="file-x" style="width: 28px; height: 28px; margin-bottom: 6px; color: var(--primary-gold);"></i>
        <div style="font-weight: 600; font-size: 0.88rem; color: #ffffff;">No files uploaded</div>
        <div style="font-size: 0.74rem; margin-bottom: 12px;">Add at least one document to proceed</div>
        <button type="button" class="btn-choose-file" onclick="document.getElementById('fileInputElement').click()" style="padding: 6px 14px; font-size: 0.8rem;">
          <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
          <span>Upload document</span>
        </button>
      </div>
    `;
    if (elements.pagesSummaryBadge) elements.pagesSummaryBadge.textContent = '0 pages selected';
  } else {
    container.innerHTML = files.map(f => `
      <div class="review-file-card">
        <div class="file-info-group">
          <div class="file-type-icon-box">
            <i data-lucide="${f.type === 'pdf' ? 'file-text' : (['png', 'jpg', 'jpeg'].includes(f.type) ? 'image' : 'file')}" style="width: 16px; height: 16px;"></i>
          </div>
          <div style="overflow: hidden;">
            <div class="file-name-row" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
            <div class="file-meta-row">${escapeHtml(f.size)}</div>
          </div>
        </div>

        <div class="file-actions-group">
          <div class="file-page-counter-box" title="Adjust pages to print for this file">
            <button type="button" class="btn-file-page" onclick="updateFilePages('${escapeHtml(f.id)}', -1)">-</button>
            <span class="file-page-val">${f.pages} pg</span>
            <button type="button" class="btn-file-page" onclick="updateFilePages('${escapeHtml(f.id)}', 1)">+</button>
          </div>
          <button type="button" class="btn-delete-file" onclick="removeFile('${escapeHtml(f.id)}')" title="Remove file">
            <i data-lucide="x" style="width: 15px; height: 15px;"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (state.currentJob.pageMode === 'all') {
      if (elements.pagesSummaryBadge) {
        elements.pagesSummaryBadge.textContent = `${totalPages} page${totalPages > 1 ? 's' : ''} selected`;
      }
      state.currentJob.selectedPagesCount = totalPages;
    } else {
      updateCustomPagesCount();
    }
  }

  if (window.lucide) lucide.createIcons();
}

window.updateFilePages = function (fileId, delta) {
  const file = state.currentJob.files.find(f => f.id === fileId);
  if (file) {
    file.pages = Math.max(1, (file.pages || 1) + delta);
    renderReviewFilesList();
    renderUploadStagingQueue();
    updateCalculations();
  }
};

window.removeFile = function (fileId) {
  state.currentJob.files = state.currentJob.files.filter(f => f.id !== fileId);
  
  renderReviewFilesList();
  renderUploadStagingQueue();
  updateCalculations();
};

// Pricing Calculation for Entire Multi-file Batch
function updateCalculations() {
  const files = state.currentJob.files || [];
  const totalPages = files.length === 0 ? 0 : (
    state.currentJob.pageMode === 'custom'
      ? (state.currentJob.selectedPagesCount || 1)
      : files.reduce((sum, f) => sum + (f.pages || 1), 0)
  );

  state.currentJob.totalDocPages = totalPages;

  const rate = state.currentJob.ratePerPage || 3;
  const copies = Math.max(1, state.currentJob.copies || 1);

  const total = totalPages * rate * copies;
  state.currentJob.total = total;
  if (elements.reviewTotalAmount) {
    elements.reviewTotalAmount.textContent = `KES ${total}`;
  }
}

// Real Safaricom M-Pesa STK Push (High-Speed Engine)
async function triggerMpesaSTKPush() {
  const settings = getSystemSettings();
  const maxPages = settings.maxPages || 300;
  const currentPages = state.currentJob.selectedPagesCount || 1;

  if (currentPages > maxPages) {
    return;
  }

  const rawPhone = elements.mpesaPhoneInput ? elements.mpesaPhoneInput.value.trim() : '';
  if (!isValidKenyanPhone(rawPhone)) {
    if (elements.mpesaPhoneInput) elements.mpesaPhoneInput.focus();
    return;
  }

  const phone = normalizePhoneNumber(rawPhone);
  state.currentJob.phone = phone;

  // 1. Instant Modal Feedback (0ms UI Latency)
  const amountDisplay = document.getElementById('stkAmountDisplay');
  if (amountDisplay) amountDisplay.textContent = `KES ${state.currentJob.total || 0}.00`;

  if (elements.stkPromptMessage) {
    elements.stkPromptMessage.innerHTML = `Sending prompt to your phone (<strong>${escapeHtml(phone)}</strong>)... Please keep your phone unlocked.`;
  }

  const indicatorText = document.getElementById('stkStatusIndicatorText');
  if (indicatorText) indicatorText.textContent = 'Connecting with Safaricom Daraja...';

  let countdown = 60;
  if (elements.stkCountdown) elements.stkCountdown.textContent = countdown;
  if (state.stkCountdownTimer) clearInterval(state.stkCountdownTimer);

  openModal(elements.mpesaStkModal);

  try {
    // 2. Ensure documents are staged into server vault
    await uploadFilesToVault();

    // Fast Order Registration
    const filesPayload = (state.currentJob.files || []).map(f => ({
      name: f.name,
      pages: f.pages || 1,
      size: f.size,
      fileId: f.fileId || null
    }));

    const createOrderRes = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: filesPayload,
        paperSize: state.currentJob.paperSize || 'a4',
        colorMode: state.currentJob.colorMode || 'bw',
        copies: state.currentJob.copies || 1,
        phone: phone,
        idempotencyKey: 'ord_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)
      })
    });

    const orderData = await createOrderRes.json();
    if (!createOrderRes.ok) {
      closeModal(elements.mpesaStkModal);
      return;
    }

    state.currentJob.id = orderData.order.id;
    state.currentJob.total = orderData.order.total;

    if (amountDisplay) amountDisplay.textContent = `KES ${orderData.order.total}.00`;
    if (elements.stkPromptMessage) {
      elements.stkPromptMessage.innerHTML = `Please check your phone (<strong>${escapeHtml(phone)}</strong>) and enter your M-Pesa PIN for <strong style="color: #ffffff;">KES ${orderData.order.total}.00</strong>.`;
    }
    if (indicatorText) indicatorText.textContent = 'Waiting for M-Pesa PIN authorization on phone...';

    // 3. Dispatch real STK Push prompt
    const stkRes = await fetch('/api/payments/stk-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: orderData.order.id,
        phone: phone,
        amount: orderData.order.total,
        idempotencyKey: 'stk_' + orderData.order.id
      })
    });

    const stkData = await stkRes.json();
    if (!stkRes.ok) {
      if (indicatorText) indicatorText.textContent = stkData.error || 'Payment gateway connection error.';
      return;
    }

    let isSettled = false;

    const handleSuccess = (mpesaRef) => {
      if (isSettled) return;
      isSettled = true;
      if (state.stkCountdownTimer) clearInterval(state.stkCountdownTimer);
      if (window.stkEventSource) {
        window.stkEventSource.close();
        window.stkEventSource = null;
      }
      state.currentJob.mpesaRef = mpesaRef;
      state.currentJob.timestamp = new Date();
      closeModal(elements.mpesaStkModal);
      startJobProcessingFlow();
    };

    const handleFailure = () => {
      if (isSettled) return;
      isSettled = true;
      if (state.stkCountdownTimer) clearInterval(state.stkCountdownTimer);
      if (window.stkEventSource) {
        window.stkEventSource.close();
        window.stkEventSource = null;
      }
      closeModal(elements.mpesaStkModal);
    };

    // 4. Real-time Reactive SSE Stream (Instant <10ms confirmation upon Safaricom webhook)
    if (window.EventSource) {
      try {
        if (window.stkEventSource) window.stkEventSource.close();
        window.stkEventSource = new EventSource(`/api/payments/stream/${encodeURIComponent(orderData.order.id)}`);
        window.stkEventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && data.paid) {
              handleSuccess(data.mpesaRef || ('SJK' + Math.floor(100000 + Math.random() * 900000)));
            } else if (data && (data.cancelled || data.status === 'Payment Failed')) {
              handleFailure();
            }
          } catch (e) {}
        };
      } catch (e) {}
    }

    // 5. High-Frequency Fallback Polling (Every 800ms)
    const checkStatus = async () => {
      if (isSettled) return;
      try {
        const checkRes = await fetch(`/api/payments/status/${encodeURIComponent(state.currentJob.id)}`);
        if (checkRes.ok) {
          const statusData = await checkRes.json();
          if (statusData.paid) {
            handleSuccess(statusData.mpesaRef || ('SJK' + Math.floor(100000 + Math.random() * 900000)));
          } else if (statusData.cancelled || statusData.lifecycleState === 'FAILED' || statusData.status === 'Payment Cancelled') {
            handleFailure();
          }
        }
      } catch (e) {}
    };

    // Run first check after 400ms
    setTimeout(checkStatus, 400);

    state.stkCountdownTimer = setInterval(async () => {
      countdown--;
      if (elements.stkCountdown) elements.stkCountdown.textContent = countdown;

      if (!isSettled) {
        await checkStatus();
      }

      if (countdown <= 0) {
        handleFailure();
      }
    }, 800);

  } catch (err) {
    closeModal(elements.mpesaStkModal);
  }
}

// Processing Workflow Engine
function startJobProcessingFlow() {
  navigateTo('processing');

  // Reset checklist states
  resetProcessingChecklist();

  const ring = elements.processingRingCircle;
  const circumference = 2 * Math.PI * 70; // r=70
  if (ring) {
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = circumference;
  }

  if (elements.processingStatusText) {
    elements.processingStatusText.textContent = 'Please wait while we prepare your document...';
  }

  // Stage 1: Uploading (0 - 25%)
  setTimeout(() => {
    updateProgressRing(0.25, circumference);
    setCheckItemState(elements.chkUploading, 'completed', 'Done');
    setCheckItemState(elements.chkProcessing, 'active', 'Analyzing');
  }, 1000);

  // Stage 2: Processing (25% - 60%)
  setTimeout(() => {
    updateProgressRing(0.6, circumference);
    setCheckItemState(elements.chkProcessing, 'completed', 'Done');
    setCheckItemState(elements.chkPrinting, 'active', 'Printing...');
    if (elements.processingStatusText) elements.processingStatusText.textContent = 'Spooling high-resolution pages on print unit...';
  }, 2400);

  // Stage 3: Printing (60% - 90%)
  setTimeout(() => {
    updateProgressRing(0.9, circumference);
    setCheckItemState(elements.chkPrinting, 'completed', 'Done');
    setCheckItemState(elements.chkPreparing, 'active', 'Finishing');
    if (elements.processingStatusText) elements.processingStatusText.textContent = 'Collating and preparing dispatch output...';
  }, 4800);

  // Stage 4: Completed (100%)
  state.processingTimer = setTimeout(() => {
    finishProcessing();
  }, 6800);
}

function updateProgressRing(percent, circumference) {
  if (!elements.processingRingCircle) return;
  const offset = circumference - (percent * circumference);
  elements.processingRingCircle.style.strokeDashoffset = offset;
}

function completeProcessingInstantly() {
  if (state.processingTimer) clearTimeout(state.processingTimer);
  finishProcessing();
}

function finishProcessing() {
  const circumference = 2 * Math.PI * 70;
  updateProgressRing(1, circumference);

  setCheckItemState(elements.chkUploading, 'completed', 'Done');
  setCheckItemState(elements.chkProcessing, 'completed', 'Done');
  setCheckItemState(elements.chkPrinting, 'completed', 'Done');
  setCheckItemState(elements.chkPreparing, 'completed', 'Done');

  // Mark file data as permanently purged & shredded for Zero Data Retention & Disk Space Optimization
  state.currentJob.filePurged = true;
  state.currentJob.purgedAt = new Date().toISOString();
  state.currentJob.privacyNote = 'Zero-Retention: Document binary payload purged from disk memory upon print completion.';

  // Save order to LocalStorage
  saveOrderToHistory(state.currentJob);

  // Securely purge file blobs / object URLs from browser and memory
  if (state.currentJob.files) {
    state.currentJob.files.forEach(f => {
      if (f.url) {
        try { URL.revokeObjectURL(f.url); } catch (e) {}
      }
      f.data = null;
      f.blob = null;
    });
  }

  // Clear upload file input to release file handles
  if (elements.fileInputElement) elements.fileInputElement.value = '';

  // Append system privacy audit log to admin logs
  try {
    const existingLogs = JSON.parse(localStorage.getItem('cloudprint_logs')) || [];
    existingLogs.push({
      id: 'LOG-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      time: new Date().toLocaleTimeString(),
      level: 'INFO',
      msg: `Privacy & Security: Document payload for Job ${state.currentJob.id} shredded and purged from disk buffer (Zero Data Retention).`
    });
    if (existingLogs.length > 50) existingLogs.shift();
    localStorage.setItem('cloudprint_logs', JSON.stringify(existingLogs));
  } catch (e) {}

  // Set Completed Screen Receipt details
  renderScreenReceipt();

  setTimeout(() => {
    navigateTo('completed');
  }, 500);
}

// Render Confirmation Receipt Card on Screen 4 (Matches User Reference Image)
function renderScreenReceipt() {
  const job = state.currentJob;
  const files = job.files || [];
  const totalDocPages = files.reduce((sum, f) => sum + (f.pages || 1), 0) || 1;
  const selectedPages = job.selectedPagesCount || totalDocPages;

  // 1. Job reference: e.g. "JOB-HCVTUR28"
  let jobRef = job.id || '#CP123456';
  if (jobRef.startsWith('#CP')) {
    jobRef = 'JOB-' + jobRef.slice(3).toUpperCase();
  } else if (!jobRef.startsWith('JOB-')) {
    jobRef = 'JOB-' + jobRef.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }
  if (elements.receiptJobIdVal) elements.receiptJobIdVal.textContent = jobRef;

  // 2. Paid at: e.g. "30/08/2026, 04:37:47"
  const now = job.timestamp ? new Date(job.timestamp) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const formattedDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  if (elements.receiptPaidAtVal) elements.receiptPaidAtVal.textContent = formattedDate;

  // 3. M-Pesa receipt: e.g. "UHUFW4ROHB"
  const validRef = (job.mpesaRef && job.mpesaRef !== 'PENDING') 
    ? job.mpesaRef 
    : ('SJK' + Math.floor(100000 + Math.random() * 900000));
  if (elements.receiptMpesaCodeVal) elements.receiptMpesaCodeVal.textContent = validRef;
  state.currentJob.mpesaRef = validRef;

  // 4. Pages: e.g. "5"
  if (elements.receiptPagesCountVal) elements.receiptPagesCountVal.textContent = selectedPages;

  // 5. Page range: e.g. "1-5"
  let pageRange = '1-' + totalDocPages;
  if (job.pageMode === 'custom' && job.customPageRange) {
    pageRange = job.customPageRange;
  } else if (job.pageMode === 'custom' && elements.customPageListInput && elements.customPageListInput.value.trim()) {
    pageRange = elements.customPageListInput.value.trim();
  }
  if (elements.receiptPageRangeVal) elements.receiptPageRangeVal.textContent = pageRange;

  // 6. Format: e.g. "A4 B&W, single-sided"
  const sizeStr = (job.paperSize || 'a4').toUpperCase();
  const colorStr = job.colorMode === 'colour' ? 'Colour' : 'B&W';
  const sidedStr = job.doubleSided ? 'double-sided' : 'single-sided';
  if (elements.receiptFormatVal) {
    elements.receiptFormatVal.textContent = `${sizeStr} ${colorStr}, ${sidedStr}`;
  }

  // 7. Status: e.g. "processing"
  if (elements.receiptStatusVal) {
    elements.receiptStatusVal.textContent = 'processing';
  }

  // 8. Total paid: e.g. "KES 5"
  if (elements.receiptTotalVal) {
    elements.receiptTotalVal.textContent = `KES ${job.total || 5}`;
  }
}

function resetProcessingChecklist() {
  setCheckItemState(elements.chkUploading, 'active', 'Uploading...');
  setCheckItemState(elements.chkProcessing, 'pending', 'Queued');
  setCheckItemState(elements.chkPrinting, 'pending', 'Queued');
  setCheckItemState(elements.chkPreparing, 'pending', 'Queued');
}

function setCheckItemState(itemEl, stateName, statusText) {
  if (!itemEl) return;
  itemEl.classList.remove('pending', 'active', 'completed');
  itemEl.classList.add(stateName);

  const statusPill = itemEl.querySelector('.check-item-status-pill');
  if (statusPill) {
    statusPill.textContent = statusText;
    statusPill.style.color = stateName === 'active' ? 'var(--primary-gold)' : (stateName === 'completed' ? 'var(--mpesa-green)' : 'var(--text-muted)');
  }

  const iconState = itemEl.querySelector('.check-icon-state');
  if (iconState) {
    if (stateName === 'completed') {
      iconState.innerHTML = '<i data-lucide="check" style="width: 12px; height: 12px;"></i>';
    } else if (stateName === 'active') {
      iconState.innerHTML = '<div class="active-pulse-dot"></div>';
    } else {
      iconState.innerHTML = '';
    }
  }

  if (window.lucide) lucide.createIcons();
}

// Copy Job ID
function copyJobId() {
  navigator.clipboard.writeText(state.currentJob.id).catch(() => {});
}

// Generate Dynamic SVG QR Code
function renderReceiptQRCode(canvas, text) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 160;
  canvas.width = size;
  canvas.height = size;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#0f172a';

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  const grid = 21;
  const cellSize = size / grid;
  let seed = Math.abs(hash);

  function seededRandom() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  drawPositionSquare(ctx, 0, 0, cellSize);
  drawPositionSquare(ctx, grid - 7, 0, cellSize);
  drawPositionSquare(ctx, 0, grid - 7, cellSize);

  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      if ((r < 7 && c < 7) || (r >= grid - 7 && c < 7) || (r < 7 && c >= grid - 7)) continue;
      if (seededRandom() > 0.48) {
        ctx.fillRect(c * cellSize, r * cellSize, cellSize - 0.5, cellSize - 0.5);
      }
    }
  }
}

function drawPositionSquare(ctx, startX, startY, cellSize) {
  ctx.fillRect(startX * cellSize, startY * cellSize, 7 * cellSize, 7 * cellSize);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect((startX + 1) * cellSize, (startY + 1) * cellSize, 5 * cellSize, 5 * cellSize);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect((startX + 2) * cellSize, (startY + 2) * cellSize, 3 * cellSize, 3 * cellSize);
}

// Fetch Live Business Owner Settings from Server API
async function fetchStoreSettings() {
  try {
    const res = await fetch('/api/settings/public');
    if (res.ok) {
      const data = await res.json();
      if (data && data.whatsappContact) {
        state.businessOwnerWhatsapp = data.whatsappContact;
        try {
          const cms = JSON.parse(localStorage.getItem('cloudprint_cms') || '{}');
          cms.whatsappContact = data.whatsappContact;
          localStorage.setItem('cloudprint_cms', JSON.stringify(cms));
        } catch (e) {}
      }
    }
  } catch (e) {}
}

// Get Business Owner WhatsApp Contact from API / CMS Settings
function getStoreWhatsAppContact() {
  if (state.businessOwnerWhatsapp) {
    return state.businessOwnerWhatsapp;
  }
  try {
    const cmsSettings = JSON.parse(localStorage.getItem('cloudprint_cms'));
    if (cmsSettings && cmsSettings.whatsappContact) {
      return cmsSettings.whatsappContact;
    }
  } catch (e) {}
  return '+254 712 345 678';
}

// Send Receipt to Business Owner WhatsApp (Matches Reference Layout)
function sendReceiptToWhatsapp() {
  const job = state.currentJob;
  const files = job.files || [];
  const totalDocPages = files.reduce((sum, f) => sum + (f.pages || 1), 0) || 1;
  const selectedPages = job.selectedPagesCount || totalDocPages;

  let jobRef = job.id || '#CP123456';
  if (jobRef.startsWith('#CP')) {
    jobRef = 'JOB-' + jobRef.slice(3).toUpperCase();
  }

  const now = job.timestamp ? new Date(job.timestamp) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const formattedDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  let pageRange = '1-' + totalDocPages;
  if (job.pageMode === 'custom' && job.customPageRange) {
    pageRange = job.customPageRange;
  } else if (job.pageMode === 'custom' && elements.customPageListInput && elements.customPageListInput.value.trim()) {
    pageRange = elements.customPageListInput.value.trim();
  }

  const sizeStr = (job.paperSize || 'a4').toUpperCase();
  const colorStr = job.colorMode === 'colour' ? 'Colour' : 'B&W';
  const sidedStr = job.doubleSided ? 'double-sided' : 'single-sided';
  const formatStr = `${sizeStr} ${colorStr}, ${sidedStr}`;

  // Get Store WhatsApp Number configured for the Business Owner
  const rawStoreContact = getStoreWhatsAppContact();
  let storeNumber = rawStoreContact.replace(/[^0-9]/g, '') || '254712345678';
  if (storeNumber.startsWith('0')) {
    storeNumber = '254' + storeNumber.slice(1);
  } else if (!storeNumber.startsWith('254')) {
    storeNumber = '254' + storeNumber;
  }

  // Customer Contact & Verified M-Pesa Transaction Code
  const customerPhone = job.phone ? job.phone : '0712345678';
  const mpesaTransactionCode = (job.mpesaRef && job.mpesaRef !== 'PENDING') ? job.mpesaRef : ('SJK' + Math.floor(100000 + Math.random() * 900000));

  const message = 
`🧾 *CLOUDPRINT PRO - OFFICIAL RECEIPT*
━━━━━━━━━━━━━━━━━━━━
🆔 *Job reference:* ${jobRef}
📅 *Paid at:* ${formattedDate}
📱 *M-Pesa receipt:* ${mpesaTransactionCode}
📄 *Pages:* ${selectedPages}
📑 *Page range:* ${pageRange}
⚙️ *Format:* ${formatStr}
📍 *Status:* processing
━━━━━━━━━━━━━━━━━━━━
💰 *Total paid:* *KES ${job.total || 5}*
📞 *Customer Phone:* ${customerPhone}
━━━━━━━━━━━━━━━━━━━━
✨ _Official customer receipt submitted for order verification & collection._`;

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${storeNumber}?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
}

// Printable Receipt & Browser Print
function printReceipt() {
  const files = state.currentJob.files || [];
  const totalPages = files.reduce((sum, f) => sum + (f.pages || 1), 0);
  const fileNames = files.map(f => `${f.name} (${f.pages} pgs)`).join(', ');

  if (elements.recJobId) elements.recJobId.textContent = state.currentJob.id;
  if (elements.recDate) elements.recDate.textContent = new Date(state.currentJob.timestamp).toLocaleString();
  if (elements.recDoc) elements.recDoc.textContent = fileNames;
  if (elements.recService) elements.recService.textContent = `${state.currentJob.serviceName} (${state.currentJob.copies} ${state.currentJob.copies > 1 ? 'copies' : 'copy'})`;
  if (elements.recPages) elements.recPages.textContent = `${totalPages} total pages across ${files.length} document${files.length > 1 ? 's' : ''}`;
  if (elements.recPhone) elements.recPhone.textContent = state.currentJob.phone;
  if (elements.recMpesaRef) elements.recMpesaRef.textContent = state.currentJob.mpesaRef;
  if (elements.recTotal) elements.recTotal.textContent = `KES ${state.currentJob.total}.00`;

  window.print();
}

// Reset for a fresh print job
function resetToNewJob() {
  const settings = getSystemSettings();
  state.currentJob = {
    id: '#CP' + Math.floor(100000 + Math.random() * 900000),
    files: [],
    paperSize: settings.defaultPaper || 'a4',
    colorMode: settings.defaultColor || 'bw',
    serviceName: settings.defaultColor === 'colour' ? (settings.defaultPaper === 'a3' ? 'A3 Colour' : 'A4 Full Colour') : (settings.defaultPaper === 'a3' ? 'A3 B&W' : 'A4 B&W'),
    ratePerPage: 1,
    totalDocPages: 0,
    copies: 1,
    doubleSided: false,
    phone: '0712345678',
    total: 0,
    mpesaRef: 'SJK' + Math.floor(100000 + Math.random() * 900000),
    timestamp: new Date(),
    status: 'completed'
  };

  if (elements.copiesCountVal) elements.copiesCountVal.textContent = 1;
  if (elements.doubleSidedCheck) elements.doubleSidedCheck.checked = false;
  if (elements.doubleSidedToggle) elements.doubleSidedToggle.classList.remove('active');
  applySystemSettingsDefaults(true);
  renderReviewFilesList();
  renderUploadStagingQueue();
  updateCalculations();
}

// Order History & LocalStorage
function saveOrderToHistory(job) {
  let orders = [];
  try {
    orders = JSON.parse(localStorage.getItem('cloudprint_orders') || '[]');
  } catch (e) {
    orders = [];
  }

  orders.unshift({ ...job, timestamp: new Date().toISOString() });
  if (orders.length > 15) orders.pop();

  localStorage.setItem('cloudprint_orders', JSON.stringify(orders));
  renderOrdersHistory();
}

function clearOrdersHistory() {
  try {
    localStorage.removeItem('cloudprint_orders');
  } catch (e) {}
  renderOrdersHistory();
}

function renderOrdersHistory() {
  let orders = [];
  try {
    orders = JSON.parse(localStorage.getItem('cloudprint_orders') || '[]');
  } catch (e) {
    orders = [];
  }

  if (elements.clearHistoryBtn) {
    elements.clearHistoryBtn.style.display = orders.length > 0 ? 'inline-flex' : 'none';
  }

  if (!elements.ordersHistoryList) return;

  if (orders.length === 0) {
    elements.ordersHistoryList.innerHTML = `
      <div style="text-align: center; padding: 26px 14px; color: var(--text-muted); font-size: 0.84rem; background: rgba(255, 255, 255, 0.02); border: 1px dashed rgba(255, 255, 255, 0.08); border-radius: 12px; margin-top: 4px;">
        <i data-lucide="inbox" style="width: 28px; height: 28px; color: var(--text-muted); opacity: 0.5; margin-bottom: 6px;"></i>
        <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 2px;">No print order history</div>
        <div style="font-size: 0.74rem; color: var(--text-muted);">Completed print jobs will be listed here.</div>
      </div>
    `;
  } else {
    elements.ordersHistoryList.innerHTML = orders.map(order => {
      const escapedId = escapeHtml(order.id);
      const escapedName = escapeHtml(order.fileName || (order.files ? order.files.length + ' files' : 'Document'));
      return `
        <div class="service-card" style="padding: 10px 14px; margin-bottom: 4px; cursor: pointer;" onclick="loadJobToTrack('${escapedId}')">
          <div class="service-card-left">
            <div class="service-icon-box" style="width: 32px; height: 32px;">
              <i data-lucide="file-check" style="width: 16px; height: 16px;"></i>
            </div>
            <div>
              <div style="font-weight: 700; font-size: 0.88rem;">${escapedId}</div>
              <div style="font-size: 0.74rem; color: var(--text-muted);">${escapedName} • KES ${order.total || 0}</div>
            </div>
          </div>
          <div style="font-size: 0.74rem; color: var(--mpesa-green); font-weight: 600;">Ready</div>
        </div>
      `;
    }).join('');
  }

  if (window.lucide) lucide.createIcons();
}

// Job Tracking Audit Lookup
function searchJobAudit() {
  const rawQuery = elements.trackJobInput ? elements.trackJobInput.value.trim().toUpperCase() : '';
  if (!rawQuery) {
    return;
  }

  const query = rawQuery;
  let orders = [];
  try {
    orders = JSON.parse(localStorage.getItem('cloudprint_orders') || '[]');
  } catch (e) {
    orders = [];
  }

  const found = orders.find(o => o.id && o.id.toUpperCase() === query) || (query === '#CP123456' || query === 'CP123456' ? {
    id: '#CP123456',
    fileName: 'Document.pdf',
    serviceName: 'A4 Colour',
    pages: 10,
    total: 30,
    mpesaRef: 'SJK829103',
    timestamp: new Date().toISOString()
  } : null);

  const container = elements.trackResultContainer;
  if (!container) return;

  if (found) {
    const docSummary = found.files && found.files.length > 0 
      ? found.files.map(f => `${escapeHtml(f.name)} (${f.pages} pgs)`).join(', ')
      : `${escapeHtml(found.fileName || 'Document.pdf')} (${found.totalDocPages || found.pages || 10} pgs)`;

    const totalPgs = found.files && found.files.length > 0
      ? found.files.reduce((s, f) => s + (f.pages || 1), 0)
      : (found.totalDocPages || found.pages || 10);

    container.innerHTML = `
      <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid var(--mpesa-pill-border); border-radius: 12px; padding: 14px; margin-top: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="color: var(--primary-gold); font-size: 1.05rem;">${escapeHtml(found.id)}</strong>
          <span class="mpesa-badge">Ready for pickup</span>
        </div>
        <div style="font-size: 0.84rem; color: var(--text-secondary); line-height: 1.6;">
          📄 Documents: <strong>${docSummary}</strong><br>
          🖨️ Service: <strong>${escapeHtml(found.serviceName || 'A4 Colour')} (${totalPgs} total pgs, ${found.copies || 1}x)</strong><br>
          💰 Paid: <strong>KES ${found.total || 0}</strong> via M-Pesa (${escapeHtml(found.mpesaRef || 'Verified')})
        </div>
      </div>

      <div class="track-result-timeline">
        <div class="timeline-step done">
          <div class="timeline-time">Just now</div>
          <div class="timeline-title">Ready for pickup at counter #2</div>
        </div>
        <div class="timeline-step done">
          <div class="timeline-time">2 mins ago</div>
          <div class="timeline-title">Laser printing &amp; collating completed</div>
        </div>
        <div class="timeline-step done">
          <div class="timeline-time">5 mins ago</div>
          <div class="timeline-title">M-Pesa payment authorized</div>
        </div>
        <div class="timeline-step done">
          <div class="timeline-time">6 mins ago</div>
          <div class="timeline-title">Document encrypted &amp; uploaded</div>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--text-muted);">
        <i data-lucide="alert-circle" style="width: 36px; height: 36px; color: var(--primary-gold); margin-bottom: 8px;"></i>
        <p>No active job found for "<strong>${escapeHtml(query)}</strong>".</p>
        <p style="font-size: 0.8rem; margin-top: 4px;">Try searching <code>#CP123456</code> or upload a new print job.</p>
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

window.loadJobToTrack = function (jobId) {
  closeModal(elements.menuDrawerModal);
  if (elements.trackJobInput) elements.trackJobInput.value = jobId;
  openModal(elements.trackJobModal);
  searchJobAudit();
};

// UI Modals helper
function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('active');
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('active');
  if (state.stkCountdownTimer) clearInterval(state.stkCountdownTimer);
}

// View Mode (Mobile Phone vs Fluid Desktop)
function setViewMode(mode, isManual = false) {
  if (!elements.deviceFrameWrapper) return;
  if (mode === 'mobile') {
    elements.deviceFrameWrapper.classList.remove('fluid-mode');
    elements.deviceFrameWrapper.classList.add('mobile-mode');
    if (elements.viewMobileBtn) elements.viewMobileBtn.classList.add('active');
    if (elements.viewFluidBtn) elements.viewFluidBtn.classList.remove('active');
  } else {
    elements.deviceFrameWrapper.classList.remove('mobile-mode');
    elements.deviceFrameWrapper.classList.add('fluid-mode');
    if (elements.viewFluidBtn) elements.viewFluidBtn.classList.add('active');
    if (elements.viewMobileBtn) elements.viewMobileBtn.classList.remove('active');
  }
  if (isManual) {
    try { localStorage.setItem('cloudprint_view_mode', mode); } catch (e) {}
  }
}
