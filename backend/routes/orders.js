import { Router } from 'express';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { validateAndPriceCart } from '../utils/cartPricing.js';
import { fulfillOrder } from '../utils/orderFulfillment.js';
import { logActivity } from '../utils/audit.js';

const router = Router();

// Only bank transfer goes through this endpoint — it's manual/informational, so the order
// is created immediately with payment_status 'pending' until an admin verifies the deposit
// (see PUT /admin/orders/:id/payment-status). Card and GCash are real, gateway-verified
// charges and must go through /api/payments/intent, which only creates the order once
// PayMongo confirms the payment actually succeeded.
router.post('/', authenticate, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, promoCode } = req.body;
    if (paymentMethod !== 'bank') {
      return res.status(400).json({ error: 'Use /api/payments/intent for card or GCash checkout' });
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
      paymentMethod: 'bank',
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
  const result = [];
  for (const o of orders) {
    const items = await db.prepare(`
      SELECT oi.*, p.name, p.image, p.slug FROM order_items oi
      JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
    `).all(o.id);
    result.push({ ...o, items });
  }
  res.json(result);
});

router.get('/:id', authenticate, async (req, res) => {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = await db.prepare(`
    SELECT oi.*, p.name, p.image, p.slug FROM order_items oi
    JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
  `).all(order.id);
  res.json({ ...order, items });
});

// Only cancellable while still 'pending' — once it moves into processing/shipped/delivered
// it's already been confirmed and fulfillment may be underway, so self-service cancellation
// stops there (same rule as bookings, whose 'confirmed' status this maps onto).
router.put('/:id/cancel', authenticate, async (req, res) => {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'cancelled') return res.status(400).json({ error: 'This order has already been cancelled' });
  if (order.status !== 'pending') return res.status(400).json({ error: 'This order is already confirmed and can no longer be cancelled' });

  const reason = (req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'A cancellation reason is required' });

  await db.prepare('UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?').run('cancelled', reason, order.id);

  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  await logActivity(req, 'order.cancel', 'order', order.id, {
    customerName: `${user.first_name} ${user.last_name}`,
    reason,
  });

  res.json({ message: 'Order cancelled' });
});

export default router;
