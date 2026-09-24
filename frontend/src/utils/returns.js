// Mirrors backend/utils/returns.js — kept in sync by hand, since the frontend and backend don't
// share a module (same arrangement as utils/ticketNumber.js).
export const RETURN_WINDOW_DAYS = 7;
export const MAX_RETURN_PHOTOS = 3;

export const returnRef = (id) => `RET-${String(id).slice(0, 8).toUpperCase()}`;
export const orderRef = (id) => `#${String(id).slice(0, 8).toUpperCase()}`;

// 'pending' and 'cancelled' would pick up sensible colours from the shared statusColor(), but the
// rest of this set is specific to returns, so the whole map lives here rather than half in each
// place — the same call SupportMessages.jsx and Approvals.jsx make for their own status sets.
export const RETURN_STATUS_STYLE = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  received: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-700',
};

export const RETURN_STATUS_LABEL = {
  pending: 'Pending Review',
  approved: 'Approved',
  received: 'Received',
  rejected: 'Not Approved',
  cancelled: 'Cancelled',
};

// What the customer should do next, shown under the badge so a status is never just a colour.
export const RETURN_STATUS_HINT = {
  pending: 'Our team is reviewing your request. Please hold on to the items for now.',
  approved: 'Approved — please send the items back to us so we can complete your refund.',
  received: 'We’ve received your items. Refunds take 5-10 business days to reach your account.',
  rejected: 'This request wasn’t approved. See the note from our team below.',
  cancelled: 'This request was cancelled.',
};

export const REFUND_STATUS_LABEL = {
  unpaid: 'Refund pending',
  refunded: 'Refunded',
  not_applicable: 'No payment to refund',
};

// Reason codes from GET /returns/eligibility/:orderId.
export const INELIGIBLE_MESSAGE = {
  not_delivered: 'This order can be returned once it has been delivered.',
  window_closed: `The ${RETURN_WINDOW_DAYS}-day return window for this order has closed.`,
  fully_returned: 'Every item on this order has already been requested for return.',
};
