// Sequential, human-facing reference for a support ticket (e.g. "TKT-00001") — the
// underlying id stays a UUID for joins/routing; this is just the number staff and
// customers actually refer to it by, same idea as staffCode.js for employees.
export function formatTicketNo(n) {
  return `TKT-${String(n).padStart(5, '0')}`;
}
