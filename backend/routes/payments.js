import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { validateAndPriceCart } from '../utils/cartPricing.js';
import { fulfillOrder } from '../utils/orderFulfillment.js';
import { createCheckoutSession, retrievePaymentIntent, verifyWebhookSignature } from '../utils/paymongo.js';
import { logActivity } from '../utils/audit.js';
import { finalizePendingBooking } from './bookings.js';

const router = Router();

// Reconstructs the priced order-items shape fulfillOrder() expects from a pending_checkouts
// row's stored snapshot. Only `product.id` is read downstream (order_items insert + stock
// deduction) — the fresh product name/image/slug for the response/email come from the JOIN
// in fulfillOrder's own SELECT, so we don't need to re-fetch full product rows here.
function orderItemsFromSnapshot(itemsJson) {
  return JSON.parse(itemsJson).map(i => ({ product: { id: i.productId }, quantity: i.quantity, price: i.price }));
}

async function finalizePendingCheckout(pending, req) {
  if (pending.order_id) {
    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(pending.order_id);
    const items = await db.prepare(`
      SELECT oi.*, p.name, p.image, p.slug FROM order_items oi
      JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
    `).all(order.id);
    return { ...order, items };
  }

  const orderItems = orderItemsFromSnapshot(pending.items);

  // Stock may have sold out between /checkout-session and now (payment can take minutes on
  // PayMongo's hosted page) — the charge is already captured, so we still fulfill and flag it
  // for admin follow-up rather than stranding a customer who already paid.
  const oversold = [];
  for (const oi of orderItems) {
    const product = await db.prepare('SELECT stock FROM products WHERE id = ?').get(oi.product.id);
    if (!product || product.stock < oi.quantity) oversold.push(oi);
  }

  const order = await fulfillOrder({
    userId: pending.user_id,
    orderItems,
    subtotal: pending.subtotal,
    discount: pending.discount,
    total: pending.total,
    appliedPromo: pending.applied_promo,
    promoCode: pending.promo_code,
    paymentMethod: pending.payment_method,
    paymentStatus: 'paid',
    shippingAddress: pending.shipping_address,
    paymongoPaymentIntentId: pending.paymongo_payment_intent_id,
  }, req || { user: { id: pending.user_id }, ip: null });

  await db.prepare("UPDATE pending_checkouts SET status = 'succeeded', order_id = ? WHERE id = ?").run(order.id, pending.id);

  if (oversold.length) {
    await logActivity(req || { user: { id: pending.user_id }, ip: null }, 'order.oversold_after_payment', 'order', order.id, {
      productIds: oversold.map(oi => oi.product.id),
    });
  }

  return order;
}

// Card, GCash, and QR Ph all go through PayMongo's hosted Checkout Session — the browser is
// sent straight to PayMongo's checkout_url, which collects the actual payment details (card
// number, GCash login, QR scan) itself. We never see or store raw card/GCash credentials this
// way, which keeps HomeLink out of PCI-DSS scope entirely. The session mints its own payment
// intent under the hood, so once that id is stashed on the pending_checkouts row, /status and
// the webhook confirm it the same way regardless of which method was picked.
router.post('/checkout-session', authenticate, async (req, res) => {
  try {
    const { items, shippingAddress, promoCode, paymentMethod } = req.body;
    if (!['card', 'gcash', 'qrph'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod must be "card", "gcash", or "qrph"' });
    }

    const { orderItems, subtotal, discount, total, appliedPromo } = await validateAndPriceCart(items, promoCode);
    const pricedItems = orderItems.map(oi => ({ productId: oi.product.id, quantity: oi.quantity, price: oi.price }));

    const pendingId = uuid();
    await db.prepare(`
      INSERT INTO pending_checkouts (id, user_id, items, subtotal, discount, total, payment_method, shipping_address, promo_code, applied_promo)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(pendingId, req.user.id, JSON.stringify(pricedItems), subtotal, discount, total, paymentMethod, shippingAddress, promoCode || null, appliedPromo);

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await createCheckoutSession({
      amount: Math.round(total * 100),
      paymentMethodTypes: [paymentMethod],
      lineItemName: 'HomeLink order',
      description: `HomeLink order (checkout ${pendingId})`,
      successUrl: `${frontendUrl}/checkout/return?pcid=${pendingId}`,
      cancelUrl: `${frontendUrl}/checkout`,
      billingName: `${user.first_name} ${user.last_name}`,
      billingEmail: user.email,
      referenceNumber: pendingId,
      metadata: { pending_checkout_id: pendingId, user_id: req.user.id },
      idempotencyKey: pendingId,
    });

    await db.prepare('UPDATE pending_checkouts SET paymongo_payment_intent_id = ? WHERE id = ?').run(session.paymentIntentId, pendingId);

    res.status(201).json({ pendingCheckoutId: pendingId, checkoutUrl: session.checkoutUrl });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/status/:pendingCheckoutId', authenticate, async (req, res) => {
  try {
    const pending = await db.prepare('SELECT * FROM pending_checkouts WHERE id = ? AND user_id = ?').get(req.params.pendingCheckoutId, req.user.id);
    if (!pending) return res.status(404).json({ error: 'Checkout not found' });

    if (pending.status === 'succeeded') {
      const order = await finalizePendingCheckout(pending, req);
      return res.json({ status: 'succeeded', order });
    }
    if (pending.status === 'failed') {
      return res.json({ status: 'failed' });
    }

    const intent = await retrievePaymentIntent(pending.paymongo_payment_intent_id);
    if (intent.status === 'succeeded') {
      const order = await finalizePendingCheckout(pending, req);
      return res.json({ status: 'succeeded', order });
    }
    if (intent.status === 'awaiting_payment_method') {
      await db.prepare("UPDATE pending_checkouts SET status = 'failed' WHERE id = ?").run(pending.id);
      return res.json({ status: 'failed', error: intent.lastPaymentError?.detail || 'Payment was declined' });
    }
    // 'processing' or 'awaiting_next_action' — still in flight, caller should keep polling
    return res.json({ status: 'processing' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Not mounted on this router — needs raw-body middleware ahead of express.json(), see server.js.
export async function paymongoWebhookHandler(req, res) {
  try {
    const signature = req.headers['paymongo-signature'];
    const rawBody = req.body.toString('utf8');
    const valid = verifyWebhookSignature(rawBody, signature, process.env.PAYMONGO_WEBHOOK_SECRET);
    if (!valid) return res.status(401).json({ error: 'Invalid webhook signature' });

    const event = JSON.parse(rawBody);
    const eventType = event?.data?.attributes?.type;
    const eventPayload = event?.data?.attributes?.data;

    // Logged deliberately: PayMongo's docs didn't yield a literal full webhook example, so
    // this confirms the payment_intent_id path is right before we stop needing it. Remove
    // once verified against a real test-mode delivery.
    console.log(`[PayMongo webhook] ${eventType}:`, JSON.stringify(eventPayload));

    if (eventType === 'payment.paid' || eventType === 'payment.failed') {
      const paymentIntentId = eventPayload?.attributes?.payment_intent_id || eventPayload?.attributes?.payment_intent?.id;
      if (!paymentIntentId) return res.status(200).json({ received: true });

      // A payment intent belongs to exactly one of the two pending tables (orders vs. service
      // bookings) — check both since the webhook fires for either kind of checkout.
      const pendingCheckout = await db.prepare('SELECT * FROM pending_checkouts WHERE paymongo_payment_intent_id = ?').get(paymentIntentId);
      const pendingBooking = pendingCheckout ? null : await db.prepare('SELECT * FROM pending_bookings WHERE paymongo_payment_intent_id = ?').get(paymentIntentId);
      const pending = pendingCheckout || pendingBooking;
      if (!pending || pending.status !== 'pending') return res.status(200).json({ received: true });

      if (eventType === 'payment.paid') {
        await (pendingCheckout ? finalizePendingCheckout(pending, null) : finalizePendingBooking(pending, null));
      } else {
        const table = pendingCheckout ? 'pending_checkouts' : 'pending_bookings';
        await db.prepare(`UPDATE ${table} SET status = 'failed' WHERE id = ?`).run(pending.id);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('PayMongo webhook error:', err.message);
    res.status(200).json({ received: true });
  }
}

export default router;
