import { v4 as uuid } from 'uuid';
import db, { withTransaction } from '../db/database.js';
import { applyVoucherUse } from './promos.js';
import { orderConfirmationEmail } from './email.js';
import { logActivity } from './audit.js';

// The single place an order actually gets created: inserts the order + line items, deducts
// stock, spends the voucher (only now that the order is real — a failed card charge upstream
// must not burn the customer's promo code), best-effort emails a receipt, and audit-logs it.
// Reused by bank-transfer checkout (immediate, 'pending'), synchronous card success
// (immediate, 'paid'), and the webhook/poll-confirmed path for GCash and 3DS card ('paid').
//
// Every write happens in one transaction, so an order is saved completely or not at all. When
// an item or the voucher has run out by now, what happens depends on whether the money is
// already captured: an unpaid (bank transfer) order is refused and rolled back, while a paid
// PayMongo order is still created — stock goes down to 0, never below — and flagged
// needs_review so staff can restock or refund instead of the customer's payment being stranded.
//
// pendingCheckoutId (PayMongo path only) is claimed inside that same transaction: its row is
// locked first, so when the webhook and the /status poll confirm the same payment at the same
// moment, the second one waits and gets the first one's order back rather than a duplicate.
export async function fulfillOrder({
  userId, orderItems, subtotal, discount, total, appliedPromo, promoCode,
  paymentMethod, paymentStatus, shippingAddress, paymongoPaymentIntentId, paymongoPaymentId,
}, actorReq, pendingCheckoutId = null) {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const paid = paymentStatus === 'paid';

  const { orderId, alreadyCreated, reviewReasons } = await withTransaction(async (tx) => {
    if (pendingCheckoutId) {
      const pending = await tx.prepare('SELECT order_id FROM pending_checkouts WHERE id = ? FOR UPDATE').get(pendingCheckoutId);
      if (pending?.order_id) return { orderId: pending.order_id, alreadyCreated: true, reviewReasons: [] };
    }

    const orderId = uuid();
    const reviewReasons = [];

    await tx.prepare(`
      INSERT INTO orders (id, user_id, subtotal, discount, total, payment_status, payment_method, shipping_address, promo_code, paymongo_payment_intent_id, paymongo_payment_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(orderId, userId, subtotal, discount, total, paymentStatus, paymentMethod, shippingAddress || user.address, appliedPromo, paymongoPaymentIntentId || null, paymongoPaymentId || null);

    const insertItem = tx.prepare('INSERT INTO order_items (id, order_id, product_id, quantity, price) VALUES (?,?,?,?,?)');
    for (const oi of orderItems) {
      await insertItem.run(uuid(), orderId, oi.product.id, oi.quantity, oi.price);
    }

    // The stock check and the deduction are one statement, so two checkouts racing for the last
    // units can't both pass. Products are updated in id order so two orders sharing products
    // always lock them the same way round and wait on each other instead of deadlocking.
    const deductStock = tx.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
    const byProductId = [...orderItems].sort((a, b) => a.product.id.localeCompare(b.product.id));
    for (const oi of byProductId) {
      const { changes } = await deductStock.run(oi.quantity, oi.product.id, oi.quantity);
      if (changes) continue;

      const product = await tx.prepare('SELECT name, stock FROM products WHERE id = ? FOR UPDATE').get(oi.product.id);
      if (!paid) throw new Error(`Insufficient stock for ${product?.name || 'an item in your cart'}`);
      await tx.prepare('UPDATE products SET stock = 0 WHERE id = ?').run(oi.product.id);
      reviewReasons.push(`${product?.name || 'A product'}: ordered ${oi.quantity}, only ${Math.max(product?.stock ?? 0, 0)} left when payment completed`);
    }

    if (promoCode && !(await applyVoucherUse(promoCode, tx))) {
      if (!paid) throw new Error('Voucher has reached maximum uses');
      // The customer already paid the discounted total, so the use still gets counted.
      await tx.prepare('UPDATE vouchers SET used_count = used_count + 1 WHERE code = ?').run(promoCode.toUpperCase());
      reviewReasons.push(`Voucher ${promoCode.toUpperCase()} was already at its usage limit when payment completed`);
    }

    if (reviewReasons.length) {
      await tx.prepare('UPDATE orders SET needs_review = 1, review_reason = ? WHERE id = ?').run(reviewReasons.join('; '), orderId);
    }
    if (pendingCheckoutId) {
      await tx.prepare("UPDATE pending_checkouts SET status = 'succeeded', order_id = ? WHERE id = ?").run(orderId, pendingCheckoutId);
    }

    return { orderId, alreadyCreated: false, reviewReasons };
  });

  const orderRow = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const fullItems = await db.prepare(`
    SELECT oi.*, p.name, p.image, p.slug FROM order_items oi
    JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
  `).all(orderId);

  if (alreadyCreated) return { ...orderRow, items: fullItems };

  // The order is already committed and stock already deducted at this point, so email sending
  // must not block or fail the response to the customer — fire it and log failures async.
  if (user.notify_orders) {
    const emailItems = fullItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price * i.quantity }));
    orderConfirmationEmail(orderRow, emailItems, user).catch((emailErr) => {
      console.error(`Failed to send order confirmation email for order ${orderId}:`, emailErr.message);
    });
  }

  await logActivity(actorReq, 'order.create', 'order', orderId, {
    customerName: `${user.first_name} ${user.last_name}`,
    total,
    itemCount: orderItems.reduce((sum, oi) => sum + oi.quantity, 0),
  });

  if (reviewReasons.length) {
    await logActivity(actorReq, 'order.needs_review', 'order', orderId, {
      customerName: `${user.first_name} ${user.last_name}`,
      reason: reviewReasons.join('; '),
    });
  }

  return { ...orderRow, items: fullItems };
}
