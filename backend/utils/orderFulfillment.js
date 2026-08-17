import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { applyVoucherUse } from './promos.js';
import { orderConfirmationEmail } from './email.js';
import { logActivity } from './audit.js';

// The single place an order actually gets created: inserts the order + line items, deducts
// stock, spends the voucher (only now that the order is real — a failed card charge upstream
// must not burn the customer's promo code), best-effort emails a receipt, and audit-logs it.
// Reused by bank-transfer checkout (immediate, 'pending'), synchronous card success
// (immediate, 'paid'), and the webhook/poll-confirmed path for GCash and 3DS card ('paid').
export async function fulfillOrder({
  userId, orderItems, subtotal, discount, total, appliedPromo, promoCode,
  paymentMethod, paymentStatus, shippingAddress, paymongoPaymentIntentId, paymongoPaymentId,
}, actorReq) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const orderId = uuid();

  db.prepare(`
    INSERT INTO orders (id, user_id, subtotal, discount, total, payment_status, payment_method, shipping_address, promo_code, paymongo_payment_intent_id, paymongo_payment_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(orderId, userId, subtotal, discount, total, paymentStatus, paymentMethod, shippingAddress || user.address, appliedPromo, paymongoPaymentIntentId || null, paymongoPaymentId || null);

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

  logActivity(actorReq, 'order.create', 'order', orderId, {
    customerName: `${user.first_name} ${user.last_name}`,
    total,
    itemCount: orderItems.reduce((sum, oi) => sum + oi.quantity, 0),
  });

  return { ...orderRow, items: fullItems };
}
