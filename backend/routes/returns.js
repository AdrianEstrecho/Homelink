import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db, { withTransaction } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { logActivity } from '../utils/audit.js';
import { notifyUser } from '../utils/notify.js';
import { returnSubmittedEmail } from '../utils/email.js';
import {
  getReturnableLines, returnEligibility, returnWindowClosesAt, prorateRefund, returnRef,
  RETURN_WINDOW_DAYS,
} from '../utils/returns.js';

const router = Router();

const MAX_PHOTOS = 3;
const MAX_ITEMS = 20;
const MIN_REASON = 10;
const MAX_REASON = 1000;
// Server-side backstop only — the picker downscales to ~300KB, so anything near these numbers
// means the client guard was bypassed. Kept well under express.json's global 10mb ceiling, which
// is shared with every other endpoint and must not be raised for this one feature.
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_PHOTOS_TOTAL_BYTES = 8 * 1024 * 1024;
const DATA_URL_RE = /^data:image\/(jpeg|png|webp|gif);base64,/;

// Decoded length from the base64 length, without actually allocating the buffer.
function dataUrlBytes(dataUrl) {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

async function existingReturnsFor(orderId) {
  const rows = await db.prepare(`
    SELECT rr.id, rr.status, rr.created_at,
           (SELECT COALESCE(SUM(ri.quantity), 0) FROM return_items ri WHERE ri.return_id = rr.id) AS item_count
    FROM return_requests rr WHERE rr.order_id = ? ORDER BY rr.created_at DESC
  `).all(orderId);
  return rows.map((r) => ({ ...r, ref: returnRef(r.id) }));
}

// Drives the request modal: which lines still have units to give back, and whether the order is
// inside its window at all. Advisory — POST re-checks all of this under a row lock.
router.get('/eligibility/:orderId', authenticate, async (req, res) => {
  const order = await db.prepare(
    'SELECT id, status, created_at, delivered_at, subtotal, discount, payment_status FROM orders WHERE id = ? AND user_id = ?'
  ).get(req.params.orderId, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const lines = await getReturnableLines(db, order.id);
  const { eligible, reason, windowClosesAt } = returnEligibility(order, lines);

  res.json({
    eligible,
    reason,
    windowClosesAt,
    refundable: order.payment_status === 'paid',
    lines,
    existingReturns: await existingReturnsFor(order.id),
  });
});

router.get('/my', authenticate, async (req, res) => {
  // Explicit columns, never SELECT * — photos live in their own table, and keeping the habit
  // means a column added later can't start shipping blobs to the list view by accident.
  const rows = await db.prepare(`
    SELECT rr.id, rr.order_id, rr.reason, rr.status, rr.refund_amount, rr.refund_status,
           rr.review_note, rr.created_at, rr.reviewed_at, rr.received_at,
           (SELECT COUNT(*) FROM return_photos rp WHERE rp.return_id = rr.id) AS photo_count
    FROM return_requests rr WHERE rr.user_id = ? ORDER BY rr.created_at DESC
  `).all(req.user.id);
  if (rows.length === 0) return res.json(rows);

  const ids = rows.map((r) => r.id);
  const items = await db.prepare(`
    SELECT ri.return_id, ri.quantity, ri.unit_price, p.name, p.image, p.slug
    FROM return_items ri JOIN products p ON p.id = ri.product_id
    WHERE ri.return_id IN (${ids.map(() => '?').join(',')})
  `).all(...ids);

  const byReturn = {};
  for (const i of items) (byReturn[i.return_id] ||= []).push(i);

  res.json(rows.map((r) => ({ ...r, ref: returnRef(r.id), items: byReturn[r.id] || [] })));
});

// The only customer route that emits image data — fetched on demand when a card is expanded, so
// the list above stays small however many photos a return carries.
router.get('/:id/photos', authenticate, async (req, res) => {
  const owned = await db.prepare('SELECT id FROM return_requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!owned) return res.status(404).json({ error: 'Return request not found' });
  res.json(await db.prepare('SELECT id, image FROM return_photos WHERE return_id = ? ORDER BY sort_order').all(req.params.id));
});

router.post('/', authenticate, async (req, res) => {
  const { orderId, reason: rawReason, items, photos } = req.body || {};
  const reason = (rawReason || '').trim();

  if (!orderId) return res.status(400).json({ error: 'An order is required' });
  if (reason.length < MIN_REASON) return res.status(400).json({ error: `Please describe the problem in at least ${MIN_REASON} characters.` });
  if (reason.length > MAX_REASON) return res.status(400).json({ error: `Please keep the reason under ${MAX_REASON} characters.` });

  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Select at least one item to return' });
  if (items.length > MAX_ITEMS) return res.status(400).json({ error: 'Too many items in one request' });
  for (const it of items) {
    if (!it?.orderItemId) return res.status(400).json({ error: 'Each item needs an order line' });
    if (!Number.isInteger(it.quantity) || it.quantity < 1) return res.status(400).json({ error: 'Quantities must be whole numbers of 1 or more' });
  }
  if (new Set(items.map((i) => i.orderItemId)).size !== items.length) {
    return res.status(400).json({ error: 'The same item was listed twice' });
  }

  if (!Array.isArray(photos) || photos.length === 0) return res.status(400).json({ error: 'At least one photo of the product is required' });
  if (photos.length > MAX_PHOTOS) return res.status(400).json({ error: `Please attach at most ${MAX_PHOTOS} photos` });
  let totalBytes = 0;
  for (const photo of photos) {
    if (typeof photo !== 'string' || !DATA_URL_RE.test(photo)) {
      return res.status(400).json({ error: 'Photos must be JPG, PNG, WebP or GIF images' });
    }
    const bytes = dataUrlBytes(photo);
    if (bytes > MAX_PHOTO_BYTES) return res.status(413).json({ error: 'One of those photos is too large. Please use a smaller image.' });
    totalBytes += bytes;
  }
  if (totalBytes > MAX_PHOTOS_TOTAL_BYTES) return res.status(413).json({ error: 'Those photos are too large together. Please use fewer or smaller images.' });

  const created = await withTransaction(async (tx) => {
    // Locking the order row first is what makes the quantity check safe: two tabs submitting at
    // once would otherwise both read committed_qty = 0 and both insert. The second one blocks
    // here, then re-reads the real total and is correctly refused. There is no database-level
    // backstop — the restock is `stock + ?`, which cannot fail — so this lock is the only thing
    // standing between a double submit and inflated inventory.
    const order = await tx.prepare(
      'SELECT id, status, created_at, delivered_at, subtotal, discount, payment_status FROM orders WHERE id = ? AND user_id = ? FOR UPDATE'
    ).get(orderId, req.user.id);
    if (!order) return { notFound: true };

    const lines = await getReturnableLines(tx, order.id);
    const { eligible, reason: why } = returnEligibility(order, lines);
    if (!eligible) {
      if (why === 'not_delivered') return { error: 'Only delivered orders can be returned.' };
      if (why === 'window_closed') {
        return { error: `The ${RETURN_WINDOW_DAYS}-day return window for this order closed on ${returnWindowClosesAt(order).toLocaleDateString('en-PH')}.` };
      }
      return { error: 'Every item on this order has already been returned.' };
    }

    const byId = new Map(lines.map((l) => [l.orderItemId, l]));
    const selected = [];
    for (const it of items) {
      const line = byId.get(it.orderItemId);
      if (!line) return { error: "That item isn't on this order." };
      if (it.quantity > line.returnableQty) {
        return {
          error: line.returnableQty === 0
            ? `You've already requested a return for every "${line.name}" on this order.`
            : `You can only return ${line.returnableQty} more of "${line.name}".`,
        };
      }
      selected.push({ ...line, quantity: it.quantity });
    }

    const id = uuid();
    // Nothing was ever collected on an unverified bank transfer or an uncollected COD, so there
    // is no payout to chase — the clerk shouldn't be left hunting for one.
    const refundStatus = order.payment_status === 'paid' ? 'unpaid' : 'not_applicable';
    await tx.prepare(`
      INSERT INTO return_requests (id, order_id, user_id, reason, refund_amount, refund_status)
      VALUES (?,?,?,?,?,?)
    `).run(id, order.id, req.user.id, reason, prorateRefund(selected, order), refundStatus);

    const insertItem = tx.prepare(
      'INSERT INTO return_items (id, return_id, order_item_id, product_id, quantity, unit_price) VALUES (?,?,?,?,?,?)'
    );
    for (const line of selected) {
      await insertItem.run(uuid(), id, line.orderItemId, line.productId, line.quantity, line.unitPrice);
    }

    // Same transaction as the parent, so a photo row can never outlive a failed request.
    const insertPhoto = tx.prepare('INSERT INTO return_photos (id, return_id, image, sort_order) VALUES (?,?,?,?)');
    for (let i = 0; i < photos.length; i++) await insertPhoto.run(uuid(), id, photos[i], i);

    return { id, order, selected };
  });

  if (created.notFound) return res.status(404).json({ error: 'Order not found' });
  if (created.error) return res.status(400).json({ error: created.error });

  const { id, order, selected } = created;
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const units = selected.reduce((n, l) => n + l.quantity, 0);

  await logActivity(req, 'return.create', 'return', id, {
    customerName: `${user.first_name} ${user.last_name}`,
    orderRef: order.id.slice(0, 8).toUpperCase(),
    returnRef: returnRef(id),
    itemCount: units,
    reason,
  });

  // No notify-by-role helper exists; the house idiom is an explicit query and a loop. Admins are
  // deliberately left out, as everywhere else — they pick these up from the audit-log bell.
  const clerks = await db.prepare("SELECT id FROM users WHERE role = 'employee' AND position = 'inventory_clerk'").all();
  for (const clerk of clerks) {
    await notifyUser(
      clerk.id, 'return.created', 'New Return Request',
      `${user.first_name} ${user.last_name} requested a return on order #${order.id.slice(0, 8).toUpperCase()} — ${units} item${units === 1 ? '' : 's'}.`,
      '/admin/returns',
    );
  }

  if (user?.notify_orders) {
    returnSubmittedEmail({ id, reason }, order, selected, user).catch((emailErr) => {
      console.error(`Failed to send return submitted email for return ${id}:`, emailErr.message);
    });
  }

  res.status(201).json({ id, ref: returnRef(id), status: 'pending' });
});

export default router;
