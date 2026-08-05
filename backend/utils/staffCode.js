import db from '../db/database.js';

const POSITION_PREFIX = {
  inventory_clerk: 'IC',
  booking_coordinator: 'BC',
  installer: 'IN',
  accounting: 'AC',
  hr: 'HR',
  general_staff: 'GS',
};

// Staff codes are assigned once and kept for life — a later position change
// (e.g. promotion to a different role) does not renumber or reprefix them.
export function generateStaffCode(role, position) {
  const prefix = role === 'admin' ? 'SA' : (POSITION_PREFIX[position] || 'EMP');
  const { c } = db.prepare('SELECT COUNT(*) as c FROM users WHERE staff_code LIKE ?').get(`${prefix}%`);
  return `${prefix}${String(c + 1).padStart(3, '0')}`;
}
