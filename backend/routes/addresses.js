import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

function formatAddress(row) {
  const line1 = [row.house_number, row.street].filter(Boolean).join(' ');
  const line2 = [row.village, row.city].filter(Boolean).join(', ');
  return [line1, line2, row.province, row.postal_code].filter(Boolean).join(', ');
}

function withFormatted(row) {
  return { ...row, fullAddress: formatAddress(row) };
}

router.get('/my', authenticate, (req, res) => {
  const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').all(req.user.id);
  res.json(addresses.map(withFormatted));
});

router.post('/', authenticate, (req, res) => {
  const { label, houseNumber, street, village, city, province, postalCode, isDefault } = req.body;
  if (!label?.trim() || !street?.trim() || !city?.trim() || !province?.trim() || !postalCode?.trim()) {
    return res.status(400).json({ error: 'Label, street, city, province, and postal code are required' });
  }

  const existingCount = db.prepare('SELECT COUNT(*) as c FROM addresses WHERE user_id = ?').get(req.user.id).c;
  const makeDefault = isDefault || existingCount === 0;
  if (makeDefault) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);

  const id = uuid();
  db.prepare(`INSERT INTO addresses (id, user_id, label, house_number, street, village, city, province, postal_code, is_default)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, req.user.id, label.trim(), houseNumber?.trim() || '', street.trim(), village?.trim() || '', city.trim(), province.trim(), postalCode.trim(), makeDefault ? 1 : 0);
  res.status(201).json(withFormatted(db.prepare('SELECT * FROM addresses WHERE id = ?').get(id)));
});

router.put('/:id', authenticate, (req, res) => {
  const existing = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Address not found' });
  const { label, houseNumber, street, village, city, province, postalCode } = req.body;
  if (!label?.trim() || !street?.trim() || !city?.trim() || !province?.trim() || !postalCode?.trim()) {
    return res.status(400).json({ error: 'Label, street, city, province, and postal code are required' });
  }
  db.prepare(`UPDATE addresses SET label=?, house_number=?, street=?, village=?, city=?, province=?, postal_code=? WHERE id=?`)
    .run(label.trim(), houseNumber?.trim() || '', street.trim(), village?.trim() || '', city.trim(), province.trim(), postalCode.trim(), req.params.id);
  res.json(withFormatted(db.prepare('SELECT * FROM addresses WHERE id = ?').get(req.params.id)));
});

router.put('/:id/default', authenticate, (req, res) => {
  const existing = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Address not found' });
  db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
  db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Default address updated' });
});

router.delete('/:id', authenticate, (req, res) => {
  const existing = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Address not found' });
  db.prepare('DELETE FROM addresses WHERE id = ?').run(req.params.id);
  if (existing.is_default) {
    const next = db.prepare('SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at ASC LIMIT 1').get(req.user.id);
    if (next) db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').run(next.id);
  }
  res.json({ message: 'Address deleted' });
});

export default router;
