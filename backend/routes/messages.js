import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { notifyUser } from '../utils/notify.js';

const router = Router();
router.use(authenticate);

// One row per conversation partner, most-recently-active first, with a preview of the
// last message and how many of their messages to us are still unread.
router.get('/threads', async (req, res) => {
  const partnerIds = await db.prepare(`
    SELECT CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END as partner_id, MAX(created_at) as last_at
    FROM staff_messages WHERE sender_id = ? OR recipient_id = ?
    GROUP BY partner_id ORDER BY last_at DESC
  `).all(req.user.id, req.user.id, req.user.id);

  const threads = [];
  for (const { partner_id } of partnerIds) {
    const partner = await db.prepare('SELECT id, first_name, last_name, position, staff_code, role FROM users WHERE id = ?').get(partner_id);
    if (!partner) continue;
    const lastMessage = await db.prepare(`
      SELECT body, sender_id, created_at FROM staff_messages
      WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
      ORDER BY created_at DESC LIMIT 1
    `).get(req.user.id, partner_id, partner_id, req.user.id);
    const unread = (await db.prepare('SELECT COUNT(*) as c FROM staff_messages WHERE sender_id = ? AND recipient_id = ? AND is_read = 0').get(partner_id, req.user.id)).c;
    threads.push({ partner, lastMessage, unread });
  }

  res.json(threads);
});

// Full history with one partner — reading it also marks their messages to us as read.
router.get('/thread/:userId', async (req, res) => {
  const partner = await db.prepare('SELECT id, first_name, last_name, position, staff_code, role FROM users WHERE id = ?').get(req.params.userId);
  if (!partner) return res.status(404).json({ error: 'User not found' });

  const rows = await db.prepare(`
    SELECT * FROM staff_messages
    WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
    ORDER BY created_at ASC
  `).all(req.user.id, req.params.userId, req.params.userId, req.user.id);
  await db.prepare('UPDATE staff_messages SET is_read = 1 WHERE sender_id = ? AND recipient_id = ? AND is_read = 0').run(req.params.userId, req.user.id);

  res.json({ partner, messages: rows.map(r => ({ ...r, is_read: !!r.is_read })) });
});

router.post('/', async (req, res) => {
  const { recipientId, body } = req.body;
  if (!recipientId || !body?.trim()) return res.status(400).json({ error: 'Recipient and message are required.' });
  const recipient = await db.prepare('SELECT id, first_name, last_name FROM users WHERE id = ?').get(recipientId);
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

  const id = uuid();
  await db.prepare('INSERT INTO staff_messages (id, sender_id, recipient_id, body) VALUES (?,?,?,?)').run(id, req.user.id, recipientId, body.trim());

  const sender = await db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').get(req.user.id);
  await notifyUser(recipientId, 'message.new', `New message from ${sender.first_name} ${sender.last_name}`, body.trim().slice(0, 100), `/admin/messages?with=${req.user.id}`);

  res.status(201).json({ id });
});

export default router;
