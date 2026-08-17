import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { validateAndPriceCart } from '../utils/cartPricing.js';
import { fulfillOrder } from '../utils/orderFulfillment.js';
import { createPaymentIntent, retrievePaymentIntent, verifyWebhookSignature } from '../utils/paymongo.js';
import { logActivity } from '../utils/audit.js';

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
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(pending.order_id);
    const items = db.prepare(`
      SELECT oi.*, p.name, p.image, p.slug FROM order_items oi
      JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
    `).all(order.id);
    return { ...order, items };
  }

  const orderItems = orderItemsFromSnapshot(pending.items);

  // Stock may have sold out between /intent and now (payment can take minutes via 3DS/GCash
  // redirect) — the charge is already captured, so we still fulfill and flag it for admin
  // follow-up rather than stranding a customer who already paid.
  const oversold = orderItems.filter(oi => {
    const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(oi.product.id);
    return !product || product.stock < oi.quantity;
  });

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

  db.prepare("UPDATE pending_checkouts SET status = 'succeeded', order_id = ? WHERE id = ?").run(order.id, pending.id);

  if (oversold.length) {
    logActivity(req || { user: { id: pending.user_id }, ip: null }, 'order.oversold_after_payment', 'order', order.id, {
      productIds: oversold.map(oi => oi.product.id),
    });
  }

  return order;
}

router.post('/intent', authenticate, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, promoCode } = req.body;
    if (!['card', 'gcash'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod must be "card" or "gcash"' });
    }

    const { orderItems, subtotal, discount, total, appliedPromo } = validateAndPriceCart(items, promoCode);
    const pricedItems = orderItems.map(oi => ({ productId: oi.product.id, quantity: oi.quantity, price: oi.price }));

    const pendingId = uuid();
    db.prepare(`
      INSERT INTO pending_checkouts (id, user_id, items, subtotal, discount, total, payment_method, shipping_address, promo_code, applied_promo)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(pendingId, req.user.id, JSON.stringify(pricedItems), subtotal, discount, total, paymentMethod, shippingAddress, promoCode || null, appliedPromo);

    const intent = await createPaymentIntent({
      amount: Math.round(total * 100),
      paymentMethodAllowed: [paymentMethod],
      description: `HomeLink order (checkout ${pendingId})`,
      metadata: { pending_checkout_id: pendingId, user_id: req.user.id },
      idempotencyKey: pendingId,
    });

    db.prepare('UPDATE pending_checkouts SET paymongo_payment_intent_id = ? WHERE id = ?').run(intent.id, pendingId);

    res.status(201).json({ pendingCheckoutId: pendingId, paymentIntentId: intent.id, clientKey: intent.clientKey });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/status/:pendingCheckoutId', authenticate, async (req, res) => {
  try {
    const pending = db.prepare('SELECT * FROM pending_checkouts WHERE id = ? AND user_id = ?').get(req.params.pendingCheckoutId, req.user.id);
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
      db.prepare("UPDATE pending_checkouts SET status = 'failed' WHERE id = ?").run(pending.id);
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

      const pending = db.prepare('SELECT * FROM pending_checkouts WHERE paymongo_payment_intent_id = ?').get(paymentIntentId);
      if (!pending || pending.status !== 'pending') return res.status(200).json({ received: true });

      if (eventType === 'payment.paid') {
        await finalizePendingCheckout(pending, null);
      } else {
        db.prepare("UPDATE pending_checkouts SET status = 'failed' WHERE id = ?").run(pending.id);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('PayMongo webhook error:', err.message);
    res.status(200).json({ received: true });
  }
}

export default router;
