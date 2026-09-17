import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { notifyUser } from '../utils/notify.js';

const router = Router();
// Staff-only: customers have their own support channel and must never see the staff directory.
router.use(authenticate, authorize('admin', 'employee'));

const GENERAL_HISTORY_LIMIT = 200;

// Every active staff member (other than the caller) is listed, whether or not there's a
// conversation with them yet — most-recently-active conversations first, then everyone else
// alphabetically — alongside a summary of the General channel pinned above them.
router.get('/threads', async (req, res) => {
  const rows = await db.prepare(`
    SELECT u.id, u.first_name, u.last_name, u.position, u.staff_code, u.role,
      lm.body AS last_body, lm.sender_id AS last_sender_id, lm.created_at AS last_at,
      COALESCE(ur.c, 0) AS unread
    FROM users u
    LEFT JOIN LATERAL (
      SELECT body, sender_id, created_at FROM staff_messages
      WHERE (sender_id = ? AND recipient_id = u.id) OR (sender_id = u.id AND recipient_id = ?)
      ORDER BY created_at DESC LIMIT 1
    ) lm ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS c FROM staff_messages WHERE sender_id = u.id AND recipient_id = ? AND is_read = 0
    ) ur ON true
    WHERE u.role IN ('admin', 'employee') AND COALESCE(u.archived, 0) = 0 AND u.id <> ?
    ORDER BY lm.created_at DESC NULLS LAST, u.first_name, u.last_name
  `).all(req.user.id, req.user.id, req.user.id, req.user.id);

  const threads = rows.map(r => ({
    partner: { id: r.id, first_name: r.first_name, last_name: r.last_name, position: r.position, staff_code: r.staff_code, role: r.role },
    lastMessage: r.last_at ? { body: r.last_body, sender_id: r.last_sender_id, created_at: r.last_at } : null,
    unread: r.unread,
  }));

  const generalLast = await db.prepare(`
    SELECT g.body, g.sender_id, g.created_at, u.first_name, u.last_name
    FROM general_chat_messages g JOIN users u ON g.sender_id = u.id
    ORDER BY g.created_at DESC LIMIT 1
  `).get();
  const generalUnread = (await db.prepare(`
    SELECT COUNT(*) AS c FROM general_chat_messages g
    LEFT JOIN general_chat_reads r ON r.user_id = ?
    WHERE g.sender_id <> ? AND (r.last_read_at IS NULL OR g.created_at > r.last_read_at)
  `).get(req.user.id, req.user.id)).c;

  res.json({ general: { lastMessage: generalLast || null, unread: generalUnread }, threads });
});

// Full history with one partner — reading it also marks their messages to us as read.
router.get('/thread/:userId', async (req, res) => {
  const partner = await db.prepare("SELECT id, first_name, last_name, position, staff_code, role FROM users WHERE id = ? AND role IN ('admin', 'employee')").get(req.params.userId);
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
  if (recipientId === req.user.id) return res.status(400).json({ error: 'You cannot message yourself.' });
  const recipient = await db.prepare("SELECT id, first_name, last_name FROM users WHERE id = ? AND role IN ('admin', 'employee') AND COALESCE(archived, 0) = 0").get(recipientId);
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

  const id = uuid();
  await db.prepare('INSERT INTO staff_messages (id, sender_id, recipient_id, body) VALUES (?,?,?,?)').run(id, req.user.id, recipientId, body.trim());

  const sender = await db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').get(req.user.id);
  await notifyUser(recipientId, 'message.new', `New message from ${sender.first_name} ${sender.last_name}`, body.trim().slice(0, 100), `/admin/messages?with=${req.user.id}`);

  res.status(201).json({ id });
});

// General channel — every staff member can read and post. Reading moves the caller's
// watermark to now, which clears their unread count for the channel.
router.get('/general', async (req, res) => {
  const rows = await db.prepare(`
    SELECT * FROM (
      SELECT g.id, g.sender_id, g.body, g.created_at, u.first_name, u.last_name, u.position, u.role
      FROM general_chat_messages g JOIN users u ON g.sender_id = u.id
      ORDER BY g.created_at DESC LIMIT ?
    ) recent ORDER BY created_at ASC
  `).all(GENERAL_HISTORY_LIMIT);
  await db.prepare(`
    INSERT INTO general_chat_reads (user_id, last_read_at) VALUES (?, now())
    ON CONFLICT (user_id) DO UPDATE SET last_read_at = now()
  `).run(req.user.id);
  res.json({ messages: rows });
});

router.post('/general', async (req, res) => {
  const body = req.body.body?.trim();
  if (!body) return res.status(400).json({ error: 'Message is required.' });
  const id = uuid();
  await db.prepare('INSERT INTO general_chat_messages (id, sender_id, body) VALUES (?,?,?)').run(id, req.user.id, body);
  res.status(201).json({ id });
});

export default router;
