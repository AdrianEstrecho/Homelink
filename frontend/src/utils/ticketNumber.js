// Mirrors backend/utils/ticketNumber.js — same format, kept in sync by hand since
// frontend and backend don't share a module.
export function formatTicketNo(n) {
  return `TKT-${String(n).padStart(5, '0')}`;
}
