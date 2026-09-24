// Mirrors backend/utils/returns.js — kept in sync by hand, since the frontend and backend don't
// share a module (same arrangement as utils/ticketNumber.js).
export const RETURN_WINDOW_DAYS = 7;
export const MAX_RETURN_PHOTOS = 3;

export const returnRef = (id) => `RET-${String(id).slice(0, 8).toUpperCase()}`;
export const orderRef = (id) => `#${String(id).slice(0, 8).toUpperCase()}`;

// Two things file through this queue. A 'return' sends delivered goods back; a 'cancellation' is
// the refund owed when a customer cancels an order they had already paid for online. They share
// the review and payout trail but not the middle of it — a cancellation never reaches 'received',
// because nothing is in transit and the stock went back the moment the order was cancelled.
export const caseRef = (id, kind = 'return') =>
  `${kind === 'cancellation' ? 'CAN' : 'RET'}-${String(id).slice(0, 8).toUpperCase()}`;

export const isCancellation = (r) => r?.kind === 'cancellation';

export const KIND_LABEL = { return: 'Return', cancellation: 'Cancellation' };
export const KIND_STYLE = {
  return: 'bg-orange-100 text-orange-800',
  cancellation: 'bg-rose-100 text-rose-800',
};

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

// A cancellation refund walks the same statuses but means something different at each one, so
// "Approved" alone would tell the customer nothing about whether their money has moved.
export const CANCELLATION_STATUS_LABEL = {
  pending: 'Refund Pending Review',
  approved: 'Refund Approved',
  received: 'Refund Approved',
  rejected: 'Refund Not Approved',
  cancelled: 'Cancelled',
};

export const statusLabel = (kind, status) =>
  (kind === 'cancellation' ? CANCELLATION_STATUS_LABEL : RETURN_STATUS_LABEL)[status] || status;

// What the customer should do next, shown under the badge so a status is never just a colour.
export const RETURN_STATUS_HINT = {
  pending: 'Our team is reviewing your request. Please hold on to the items for now.',
  approved: 'Approved — please send the items back to us so we can complete your refund.',
  received: 'We’ve received your items. Refunds take 5-10 business days to reach your account.',
  rejected: 'This request wasn’t approved. See the note from our team below.',
  cancelled: 'This request was cancelled.',
};

// Nothing is ever shipped back on a cancellation, so every line here is about the money.
export const CANCELLATION_STATUS_HINT = {
  pending: 'Your order is cancelled. Our team is reviewing the refund — there’s nothing for you to send back.',
  approved: 'Your refund has been approved and is on its way back to you.',
  received: 'Your refund has been approved and is on its way back to you.',
  rejected: 'This refund wasn’t approved. See the note from our team below.',
  cancelled: 'This refund request was cancelled.',
};

export const statusHint = (kind, status) =>
  (kind === 'cancellation' ? CANCELLATION_STATUS_HINT : RETURN_STATUS_HINT)[status] || '';

export const REFUND_STATUS_LABEL = {
  unpaid: 'Refund pending',
  refunded: 'Refunded',
  not_applicable: 'No payment to refund',
};

// A cancellation never carries 'not_applicable' — one is only ever filed for an order that was
// actually paid for — but the map is total so an unexpected value can't render as blank.
export const CANCELLATION_REFUND_STATUS_LABEL = {
  unpaid: 'Refund not sent yet',
  refunded: 'Refund sent',
  not_applicable: 'No payment to refund',
};

export const refundStatusLabel = (kind, refundStatus) =>
  (kind === 'cancellation' ? CANCELLATION_REFUND_STATUS_LABEL : REFUND_STATUS_LABEL)[refundStatus] || refundStatus;

// Reason codes from GET /returns/eligibility/:orderId.
export const INELIGIBLE_MESSAGE = {
  not_delivered: 'This order can be returned once it has been delivered.',
  window_closed: `The ${RETURN_WINDOW_DAYS}-day return window for this order has closed.`,
  fully_returned: 'Every item on this order has already been requested for return.',
};
