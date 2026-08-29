/**
 * CloudPrint Pro - Print Job State Machine & Idempotency Engine
 * Enforces strictly defined transitions:
 * UPLOADED -> PAYMENT_PENDING -> PAID -> QUEUED -> PROCESSING -> PRINTING -> COMPLETED
 * Terminal / Alternate states: FAILED, CANCELLED, REFUNDED
 */

const ALLOWED_TRANSITIONS = {
  UPLOADED: ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_PENDING: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['QUEUED', 'REFUNDED'],
  QUEUED: ['PROCESSING', 'PRINTING', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['PRINTING', 'FAILED', 'CANCELLED', 'REFUNDED'],
  PRINTING: ['COMPLETED', 'FAILED'],
  COMPLETED: ['REFUNDED'], // Allows post-print financial reversal if needed
  FAILED: ['QUEUED', 'REFUNDED', 'CANCELLED'], // Allows retry
  CANCELLED: [],
  REFUNDED: []
};

/**
 * Validates whether a job can transition from currentState to targetState
 */
function isValidTransition(currentState, targetState) {
  const current = (currentState || 'UPLOADED').toUpperCase();
  const target = (targetState || '').toUpperCase();

  if (current === target) return true; // Idempotent no-op

  const allowed = ALLOWED_TRANSITIONS[current] || [];
  return allowed.includes(target);
}

/**
 * Computes authoritative price server-side based on system pricing rates
 */
function calculateAuthoritativePrice(pricing, paperSize, colorMode, totalPages, copies) {
  const size = (paperSize || 'a4').toLowerCase();
  const color = (colorMode || 'bw').toLowerCase();
  const pages = Math.max(1, parseInt(totalPages, 10) || 1);
  const numCopies = Math.max(1, parseInt(copies, 10) || 1);

  let rate = 1;
  if (size === 'a3') {
    rate = color === 'colour' ? (pricing.a3_colour || 5) : (pricing.a3_bw || 2);
  } else {
    rate = color === 'colour' ? (pricing.a4_colour || 3) : (pricing.a4_bw || 1);
  }

  const total = pages * rate * numCopies;
  return {
    paperSize: size,
    colorMode: color,
    ratePerPage: rate,
    totalPages: pages,
    copies: numCopies,
    totalAmount: total
  };
}

module.exports = {
  ALLOWED_TRANSITIONS,
  isValidTransition,
  calculateAuthoritativePrice
};
