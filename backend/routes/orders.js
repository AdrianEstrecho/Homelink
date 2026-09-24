import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db, { withTransaction } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { validateAndPriceCart } from '../utils/cartPricing.js';
import { fulfillOrder } from '../utils/orderFulfillment.js';
import { releaseOrderStock } from '../utils/orderStock.js';
import {
  getReturnableTotals, getReturnCounts, canReturnOrder, returnWindowClosesAt,
  cancellationNeedsRefund, caseRef,
} from '../utils/returns.js';
import { logActivity } from '../utils/audit.js';
import { notifyUser } from '../utils/notify.js';
import { orderStatusEmail, cancellationRefundEmail } from '../utils/email.js';
import { ORDER_STEPS, ORIGIN, getOrderTimeline, getOrderDestination, haversineKm, estimateShippingDays } from '../utils/tracking.js';

const router = Router();

// The two methods no gateway ever sees go through this endpoint: bank transfer (the customer
// deposits and staff verify it) and cash on delivery (the rider collects on the doorstep).
// Neither has money attached yet at this point, so the order is created immediately with
// payment_status 'pending' — a bank order is marked paid by hand once the deposit is verified
// (PUT /admin/orders/:id/payment-status), a COD order the moment it's marked delivered.
// Card, GCash, and QR Ph are real, gateway-verified charges and must go through
// /api/payments/checkout-session, which only creates the order once PayMongo confirms the
// payment actually succeeded.
const OFFLINE_PAYMENT_METHODS = ['bank', 'cod'];

router.post('/', authenticate, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, promoCode } = req.body;
    if (!OFFLINE_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Use /api/payments/checkout-session for card, GCash, or QR Ph checkout' });
    }

    const { orderItems, subtotal, discount, total, appliedPromo } = await validateAndPriceCart(items, promoCode);

    const order = await fulfillOrder({
      userId: req.user.id,
      orderItems,
      subtotal,
      discount,
      total,
      appliedPromo,
      promoCode,
      paymentMethod,
      paymentStatus: 'pending',
      shippingAddress,
    }, req);

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/my', authenticate, async (req, res) => {
  const orders = await db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  // One query for every order, not one per order — this loop is already N+1 on items.
  const returnable = await getReturnableTotals(db, req.user.id);
  const returnCounts = await getReturnCounts(db, req.user.id);
  const result = [];
  for (const o of orders) {
    const items = await db.prepare(`
      SELECT oi.*, p.name, p.image, p.slug, p.brand FROM order_items oi
      JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
    `).all(o.id);
    result.push({
      ...o,
      items,
      canReturn: canReturnOrder(o, returnable.get(o.id) ?? 0),
      returnCount: returnCounts.get(o.id) ?? 0,
      // The order row itself stays 'delivered' — the return window and the refund both hang off
      // that — but to the customer who sent it back the order is returned, so it shows that way
      // and files under Returns instead of To Review. A fully refunded order counts even without
      // a request row, since the money going back is the return.
      returned: (returnCounts.get(o.id) ?? 0) > 0 || o.payment_status === 'refunded',
    });
  }
  res.json(result);
});

router.get('/:id', authenticate, async (req, res) => {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = await db.prepare(`
    SELECT oi.*, p.name, p.image, p.slug, p.brand FROM order_items oi
    JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
  `).all(order.id);
  const returnable = await getReturnableTotals(db, req.user.id);
  res.json({
    ...order,
    items,
    canReturn: canReturnOrder(order, returnable.get(order.id) ?? 0),
    returnWindowClosesAt: order.status === 'delivered' ? returnWindowClosesAt(order) : null,
  });
});

router.get('/:id/tracking', authenticate, async (req, res) => {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const destination = await getOrderDestination(order);
  let etaDays = null;
  let estimatedDeliveryDate = null;
  if (destination) {
    etaDays = estimateShippingDays(haversineKm(ORIGIN, destination));
    const estimate = new Date(order.created_at);
    estimate.setDate(estimate.getDate() + 1 + etaDays); // +1 day processing lead time
    estimatedDeliveryDate = estimate.toISOString();
  }

  res.json({
    status: order.status,
    cancelReason: order.cancel_reason,
    steps: ORDER_STEPS,
    timeline: await getOrderTimeline(order),
    origin: ORIGIN,
    destination,
    etaDays,
    estimatedDeliveryDate,
  });
});

// Only cancellable while still 'pending' — once it moves into processing/shipped/delivered
// it's already been confirmed and fulfillment may be underway, so self-service cancellation
// stops there (same rule as bookings, whose 'confirmed' status this maps onto).
//
// The cancellation itself always goes through — it is never held pending a review. What depends
// on how the order was paid is whether money has to travel back afterwards: a card, GCash, QR Ph
// or verified bank-transfer order was charged before this point, so it raises a cancellation
// refund for a clerk to approve and pay out, while a COD or unverified-bank order took no money
// and simply ends here. See cancellationNeedsRefund() for why payment_status is the whole test.
router.put('/:id/cancel', authenticate, async (req, res) => {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'cancelled') return res.status(400).json({ error: 'This order has already been cancelled' });
  if (order.status !== 'pending') return res.status(400).json({ error: 'This order is already confirmed and can no longer be cancelled' });

  const reason = (req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'A cancellation reason is required' });

  // The units were taken off the shelf at checkout, so cancelling puts them straight back —
  // in the same transaction as the status change, so stock can never be credited for an order
  // that failed to cancel (or a cancelled order whose stock silently stayed reserved). The
  // refund request rides along too: a cancelled paid order that failed to file one would leave
  // the customer out of pocket with nothing in any queue to catch it.
  const { units, refund, alreadyCancelled } = await withTransaction(async (tx) => {
    // Re-read under a row lock so two tabs cancelling at once can't both pass the status check
    // above and then file two refund requests for the same money.
    const locked = await tx.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ? FOR UPDATE').get(order.id, req.user.id);
    if (locked.status !== 'pending') return { alreadyCancelled: true };

    await tx.prepare('UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?').run('cancelled', reason, locked.id);
    const released = await releaseOrderStock(locked.id, tx);
    if (!cancellationNeedsRefund(locked)) return { units: released.units, refund: null };

    // Nothing was shipped, so the whole order total goes back — no pro-rating, which only exists
    // for partial returns of individual lines. 'unpaid' until a clerk actually moves the money.
    const refundId = uuid();
    await tx.prepare(`
      INSERT INTO return_requests (id, order_id, user_id, kind, reason, refund_amount, refund_status)
      VALUES (?,?,?,'cancellation',?,?,'unpaid')
    `).run(refundId, locked.id, req.user.id, reason, locked.total);

    // Mirrored onto return_items so the clerk sees what they are refunding without a second
    // query, exactly as a return does. These rows hold no claim on returnable stock — every
    // quantity query in utils/returns.js filters on kind = 'return'.
    const lines = await tx.prepare('SELECT id, product_id, quantity, price FROM order_items WHERE order_id = ?').all(locked.id);
    const insertItem = tx.prepare(
      'INSERT INTO return_items (id, return_id, order_item_id, product_id, quantity, unit_price) VALUES (?,?,?,?,?,?)'
    );
    for (const l of lines) await insertItem.run(uuid(), refundId, l.id, l.product_id, l.quantity, l.price);

    return { units: released.units, refund: { id: refundId, amount: locked.total } };
  });

  if (alreadyCancelled) return res.status(409).json({ error: 'This order has already been cancelled' });

  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  await logActivity(req, 'order.cancel', 'order', order.id, {
    customerName: `${user.first_name} ${user.last_name}`,
    reason,
    unitsReturned: units,
    refundRef: refund ? caseRef(refund.id, 'cancellation') : null,
    refundAmount: refund ? refund.amount : null,
  });

  if (refund) {
    await logActivity(req, 'return.create', 'return', refund.id, {
      kind: 'cancellation',
      customerName: `${user.first_name} ${user.last_name}`,
      orderRef: order.id.slice(0, 8).toUpperCase(),
      returnRef: caseRef(refund.id, 'cancellation'),
      itemCount: units,
      refundAmount: refund.amount,
      reason,
    });

    // Same recipients as a return request — the clerks who work that queue. No notify-by-role
    // helper exists; the house idiom is an explicit query and a loop.
    const clerks = await db.prepare("SELECT id FROM users WHERE role = 'employee' AND position = 'inventory_clerk'").all();
    for (const clerk of clerks) {
      await notifyUser(
        clerk.id, 'return.created', 'Cancellation Refund to Approve',
        `${user.first_name} ${user.last_name} cancelled paid order #${order.id.slice(0, 8).toUpperCase()} — a refund needs approving.`,
        '/admin/returns',
      );
    }
  }

  if (user?.notify_orders) {
    // One email, not two: the refund notice already says the order was cancelled, and sending
    // the generic status email alongside it would read as two contradictory half-stories.
    const email = refund
      ? cancellationRefundEmail({ id: refund.id, reason, refund_amount: refund.amount }, order, user)
      : orderStatusEmail(order, user, 'cancelled');
    email.catch((emailErr) => {
      console.error(`Failed to send order cancelled email for order ${order.id}:`, emailErr.message);
    });
  }

  res.json({
    message: 'Order cancelled',
    refund: refund ? { ref: caseRef(refund.id, 'cancellation'), amount: refund.amount } : null,
  });
});

export default router;
