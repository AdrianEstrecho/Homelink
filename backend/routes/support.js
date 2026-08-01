import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { logActivity } from '../utils/audit.js';

const router = Router();

router.get('/my', authenticate, (req, res) => {
  const messages = db.prepare('SELECT * FROM support_messages WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(messages);
});

router.post('/', authenticate, (req, res) => {
  const { type, subject, message } = req.body;
  if (!subject?.trim() || !message?.trim()) return res.status(400).json({ error: 'Subject and message are required' });
  const kind = type === 'complaint' ? 'complaint' : 'support';

  const user = db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').get(req.user.id);
  const id = uuid();
  db.prepare('INSERT INTO support_messages (id, user_id, type, subject, message) VALUES (?,?,?,?,?)')
    .run(id, req.user.id, kind, subject.trim(), message.trim());
  logActivity(req, 'support.create', 'support', id, { customerName: `${user.first_name} ${user.last_name}`, type: kind, subject: subject.trim() });

  res.status(201).json(db.prepare('SELECT * FROM support_messages WHERE id = ?').get(id));
});

export default router;
