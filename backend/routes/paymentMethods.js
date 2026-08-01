import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const SAFE_COLUMNS = 'id, brand, last4, exp_month, exp_year, is_default, created_at';

function detectBrand(number) {
  if (/^4/.test(number)) return 'Visa';
  if (/^5[1-5]/.test(number)) return 'Mastercard';
  if (/^3[47]/.test(number)) return 'Amex';
  if (/^6(?:011|5)/.test(number)) return 'Discover';
  return 'Card';
}

router.get('/my', authenticate, (req, res) => {
  const methods = db.prepare(`SELECT ${SAFE_COLUMNS} FROM payment_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`).all(req.user.id);
  res.json(methods);
});

router.post('/', authenticate, (req, res) => {
  const { cardNumber, expMonth, expYear, isDefault } = req.body;
  const digits = (cardNumber || '').replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return res.status(400).json({ error: 'Enter a valid card number' });
  const month = Number(expMonth), year = Number(expYear);
  if (!month || month < 1 || month > 12 || !year) return res.status(400).json({ error: 'Enter a valid expiry date' });

  const existingCount = db.prepare('SELECT COUNT(*) as c FROM payment_methods WHERE user_id = ?').get(req.user.id).c;
  const makeDefault = isDefault || existingCount === 0;
  if (makeDefault) db.prepare('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?').run(req.user.id);

  const id = uuid();
  db.prepare('INSERT INTO payment_methods (id, user_id, brand, last4, exp_month, exp_year, is_default) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.user.id, detectBrand(digits), digits.slice(-4), month, year, makeDefault ? 1 : 0);
  res.status(201).json(db.prepare(`SELECT ${SAFE_COLUMNS} FROM payment_methods WHERE id = ?`).get(id));
});

router.put('/:id/default', authenticate, (req, res) => {
  const existing = db.prepare('SELECT * FROM payment_methods WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Payment method not found' });
  db.prepare('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?').run(req.user.id);
  db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Default payment method updated' });
});

router.delete('/:id', authenticate, (req, res) => {
  const existing = db.prepare('SELECT * FROM payment_methods WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Payment method not found' });
  db.prepare('DELETE FROM payment_methods WHERE id = ?').run(req.params.id);
  res.json({ message: 'Payment method removed' });
});

export default router;
