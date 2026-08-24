import { Router } from 'express';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { validateVoucher, getHolidayDiscount } from '../utils/promos.js';

const router = Router();

router.post('/validate-voucher', authenticate, async (req, res) => {
  const { code, amount } = req.body;
  const result = await validateVoucher(code, amount || 0);
  if (!result.valid) return res.status(400).json({ error: result.error });
  res.json({ valid: true, discountType: result.voucher.discount_type, discountValue: result.voucher.discount_value });
});

router.get('/active', authenticate, async (req, res) => {
  const holiday = getHolidayDiscount();
  const vouchers = await db.prepare('SELECT code, discount_type, discount_value, min_order FROM vouchers WHERE active = 1 AND used_count < max_uses ORDER BY discount_value DESC LIMIT 5').all();
  res.json({ holiday, vouchers });
});

router.get('/location', (req, res) => {
  res.json({
    lat: Number(process.env.COMPANY_LAT) || 14.5995,
    lng: Number(process.env.COMPANY_LNG) || 120.9842,
    address: process.env.COMPANY_ADDRESS || '123 HomeLink Avenue, Metro Manila, Philippines',
    mapsUrl: `https://www.google.com/maps?q=${process.env.COMPANY_LAT || 14.5995},${process.env.COMPANY_LNG || 120.9842}`,
  });
});

export default router;
