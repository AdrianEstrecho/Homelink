import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { logActivity } from '../utils/audit.js';

const router = Router();

router.get('/my', authenticate, (req, res) => {
  const messages = db.prepare('SELECT * FROM support_messages WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  if (messages.length === 0) return res.json(messages);

  // Replies are shown under a generic "HomeLink Support" label rather than the individual
  // staff member's name — who's on the other end of a ticket isn't the customer's business.
  const ids = messages.map(m => m.id);
  const replies = db.prepare(`
    SELECT id, message_id, body, created_at FROM support_replies
    WHERE message_id IN (${ids.map(() => '?').join(',')})
    ORDER BY created_at ASC
  `).all(...ids);
  const repliesByMessage = {};
  for (const r of replies) (repliesByMessage[r.message_id] ||= []).push(r);

  res.json(messages.map(m => ({ ...m, replies: repliesByMessage[m.id] || [] })));
});

router.post('/', authenticate, (req, res) => {
  const { type, subject, message } = req.body;
  if (!subject?.trim() || !message?.trim()) return res.status(400).json({ error: 'Subject and message are required' });
  const kind = type === 'complaint' ? 'complaint' : 'support';

  const user = db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').get(req.user.id);
  const id = uuid();
  const ticketNumber = db.prepare('SELECT COALESCE(MAX(ticket_number),0) as n FROM support_messages').get().n + 1;
  db.prepare('INSERT INTO support_messages (id, user_id, type, subject, message, ticket_number) VALUES (?,?,?,?,?,?)')
    .run(id, req.user.id, kind, subject.trim(), message.trim(), ticketNumber);
  logActivity(req, 'support.create', 'support', id, { customerName: `${user.first_name} ${user.last_name}`, type: kind, subject: subject.trim(), ticketNumber });

  res.status(201).json(db.prepare('SELECT * FROM support_messages WHERE id = ?').get(id));
});

export default router;
