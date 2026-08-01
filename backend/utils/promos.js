import db from '../db/database.js';

const HOLIDAYS = ['01-01', '12-25', '06-12', '08-21', '11-01', '11-30'];

export function getHolidayDiscount() {
  const today = new Date();
  const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return HOLIDAYS.includes(mmdd) ? { type: 'percent', value: 10, label: 'Holiday Discount (10%)' } : null;
}

export function getFirstTimeServiceDiscount(userId) {
  const count = db.prepare('SELECT COUNT(*) as c FROM bookings WHERE user_id = ?').get(userId);
  return count.c === 0 ? { type: 'percent', value: 15, label: 'First-Time Service Discount (15%)' } : null;
}

export function validateVoucher(code, orderTotal) {
  const voucher = db.prepare('SELECT * FROM vouchers WHERE code = ? AND active = 1').get(code.toUpperCase());
  if (!voucher) return { valid: false, error: 'Invalid voucher code' };
  if (voucher.used_count >= voucher.max_uses) return { valid: false, error: 'Voucher has reached maximum uses' };
  const now = new Date().toISOString();
  if (voucher.valid_from && now < voucher.valid_from) return { valid: false, error: 'Voucher not yet valid' };
  if (voucher.valid_until && now > voucher.valid_until) return { valid: false, error: 'Voucher has expired' };
  if (orderTotal < voucher.min_order) return { valid: false, error: `Minimum order of ₱${voucher.min_order} required` };
  return { valid: true, voucher };
}

export function calculateDiscount(amount, promo) {
  if (!promo) return 0;
  if (promo.type === 'percent') return Math.round(amount * promo.value / 100 * 100) / 100;
  return Math.min(promo.value, amount);
}

export function applyVoucherUse(code) {
  db.prepare('UPDATE vouchers SET used_count = used_count + 1 WHERE code = ?').run(code.toUpperCase());
}
