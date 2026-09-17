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

router.get('/about-hero', async (req, res) => {
  const rows = await db.prepare("SELECT key, value FROM site_settings WHERE key IN ('about_heading','about_intro')").all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({ heading: settings.about_heading || null, intro: settings.about_intro || null });
});

router.get('/location', async (req, res) => {
  const rows = await db.prepare("SELECT key, value FROM site_settings WHERE key IN ('contact_address','contact_phone','contact_email','contact_lat','contact_lng')").all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const lat = Number(settings.contact_lat || process.env.COMPANY_LAT) || 14.5995;
  const lng = Number(settings.contact_lng || process.env.COMPANY_LNG) || 120.9842;
  res.json({
    lat,
    lng,
    address: settings.contact_address || process.env.COMPANY_ADDRESS || '123 HomeLink Avenue, Metro Manila, Philippines',
    phone: settings.contact_phone || '(02) 8123-4567',
    email: settings.contact_email || 'support@homelink.com',
    mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
  });
});

export default router;
