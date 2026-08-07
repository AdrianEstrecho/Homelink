import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { getHolidayDiscount, validateVoucher, calculateDiscount, applyVoucherUse } from '../utils/promos.js';
import { orderConfirmationEmail } from '../utils/email.js';
import { logActivity } from '../utils/audit.js';

const router = Router();

router.post('/', authenticate, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, promoCode } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'Cart is empty' });

    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
      if (!product) return res.status(400).json({ error: `Product not found: ${item.productId}` });
      if (product.stock < item.quantity) return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      subtotal += product.price * item.quantity;
      orderItems.push({ product, quantity: item.quantity, price: product.price });
    }

    let discount = 0;
    let appliedPromo = null;
    const holiday = getHolidayDiscount();
    if (holiday) { discount += calculateDiscount(subtotal - discount, holiday); appliedPromo = holiday.label; }
    if (promoCode) {
      const v = validateVoucher(promoCode, subtotal);
      if (!v.valid) return res.status(400).json({ error: v.error });
      const vd = calculateDiscount(subtotal - discount, { type: v.voucher.discount_type, value: v.voucher.discount_value });
      discount += vd;
      appliedPromo = promoCode.toUpperCase();
    }

    const total = Math.max(0, subtotal - discount);
    const orderId = uuid();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    db.prepare('INSERT INTO orders (id, user_id, subtotal, discount, total, payment_status, payment_method, shipping_address, promo_code) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(orderId, req.user.id, subtotal, discount, total, 'paid', paymentMethod || 'card', shippingAddress || user.address, appliedPromo);

    const insertItem = db.prepare('INSERT INTO order_items (id, order_id, product_id, quantity, price) VALUES (?,?,?,?,?)');
    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const oi of orderItems) {
      insertItem.run(uuid(), orderId, oi.product.id, oi.quantity, oi.price);
      updateStock.run(oi.quantity, oi.product.id);
    }
    if (promoCode) applyVoucherUse(promoCode);

    const orderRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const fullItems = db.prepare(`
      SELECT oi.*, p.name, p.image, p.slug FROM order_items oi
      JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
    `).all(orderId);

    // The order is already committed and stock already deducted at this point, so a flaky
    // SMTP connection must not turn a successful purchase into a 500 for the customer.
    try {
      const emailItems = fullItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price * i.quantity }));
      await orderConfirmationEmail(orderRow, emailItems, user);
    } catch (emailErr) {
      console.error(`Failed to send order confirmation email for order ${orderId}:`, emailErr.message);
    }

    logActivity(req, 'order.create', 'order', orderId, {
      customerName: `${user.first_name} ${user.last_name}`,
      total,
      itemCount: orderItems.reduce((sum, oi) => sum + oi.quantity, 0),
    });

    res.status(201).json({ ...orderRow, items: fullItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my', authenticate, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const result = orders.map(o => {
    const items = db.prepare(`
      SELECT oi.*, p.name, p.image, p.slug FROM order_items oi
      JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
    `).all(o.id);
    return { ...o, items };
  });
  res.json(result);
});

router.get('/:id', authenticate, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = db.prepare(`
    SELECT oi.*, p.name, p.image, p.slug FROM order_items oi
    JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
  `).all(order.id);
  res.json({ ...order, items });
});

// Only cancellable while still 'pending' — once it moves into processing/shipped/delivered
// it's already been confirmed and fulfillment may be underway, so self-service cancellation
// stops there (same rule as bookings, whose 'confirmed' status this maps onto).
router.put('/:id/cancel', authenticate, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'cancelled') return res.status(400).json({ error: 'This order has already been cancelled' });
  if (order.status !== 'pending') return res.status(400).json({ error: 'This order is already confirmed and can no longer be cancelled' });

  const reason = (req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'A cancellation reason is required' });

  db.prepare('UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?').run('cancelled', reason, order.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  logActivity(req, 'order.cancel', 'order', order.id, {
    customerName: `${user.first_name} ${user.last_name}`,
    reason,
  });

  res.json({ message: 'Order cancelled' });
});

export default router;
