import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db, { withTransaction } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { validateAndPriceCart } from '../utils/cartPricing.js';
import { fulfillOrder } from '../utils/orderFulfillment.js';
import { holdStock, releaseHeldStock, closeCheckout, checkoutFailureMessage, sendCheckoutError } from '../utils/checkoutStock.js';
import { createCheckoutSessionV2, retrieveCheckoutSession, expireCheckoutSession, createPaymentIntent, attachPaymentIntent, retrievePaymentIntent, verifyWebhookSignature } from '../utils/paymongo.js';
import { resolveFrontendUrl } from '../utils/frontendUrl.js';
import { getEnabledGatewayMethods } from '../utils/siteSettings.js';
import { finalizePendingBooking } from './bookings.js';

const router = Router();

// Which of card / GCash / QR Ph the admin has left switched on, so the checkout and service
// booking pickers only show what /checkout-session will actually accept.
router.get('/methods', async (req, res) => {
  res.json({ gateway: await getEnabledGatewayMethods() });
});

// Reconstructs the priced order-items shape fulfillOrder() expects from a pending_checkouts
// row's stored snapshot. Only `product.id` is read downstream (order_items insert + stock
// deduction) — the fresh product name/image/slug for the response/email come from the JOIN
// in fulfillOrder's own SELECT, so we don't need to re-fetch full product rows here.
function orderItemsFromSnapshot(itemsJson) {
  return JSON.parse(itemsJson).map(i => ({ product: { id: i.productId }, quantity: i.quantity, price: i.price }));
}

export async function finalizePendingCheckout(pending, req) {
  if (pending.order_id) {
    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(pending.order_id);
    const items = await db.prepare(`
      SELECT oi.*, p.name, p.image, p.slug FROM order_items oi
      JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
    `).all(order.id);
    return { ...order, items };
  }

  // The units were set aside when the customer confirmed (checkoutStock.js), but the voucher's
  // last use, or the stock of a checkout whose hold was handed back, may have run out since —
  // payment can take minutes on PayMongo's hosted page. The charge is already captured, so
  // fulfillOrder still creates the order and flags it needs_review rather than stranding a
  // customer who already paid. Passing pending.id also makes it mark this checkout succeeded in
  // the same transaction, so a webhook and a /status poll landing together yield one order.
  return await fulfillOrder({
    userId: pending.user_id,
    orderItems: orderItemsFromSnapshot(pending.items),
    subtotal: pending.subtotal,
    discount: pending.discount,
    shippingFee: pending.shipping_fee,
    tax: pending.tax,
    taxRate: pending.tax_rate,
    total: pending.total,
    appliedPromo: pending.applied_promo,
    promoCode: pending.promo_code,
    paymentMethod: pending.payment_method,
    paymentStatus: 'paid',
    shippingAddress: pending.shipping_address,
    paymongoPaymentIntentId: pending.paymongo_payment_intent_id,
  }, req || { user: { id: pending.user_id }, ip: null }, pending.id);
}

async function rememberPaymentIntent(pending, paymentIntentId) {
  if (!paymentIntentId || paymentIntentId === pending.paymongo_payment_intent_id) return;
  await db.prepare('UPDATE pending_checkouts SET paymongo_payment_intent_id = ? WHERE id = ?').run(paymentIntentId, pending.id);
  pending.paymongo_payment_intent_id = paymentIntentId;
}

// Ends a checkout the customer didn't pay for and puts its units back on sale. PayMongo is asked
// first, so this never undoes a real payment: a paid checkout becomes its order instead, and a
// session PayMongo won't expire because a payment on it is still going through keeps its hold.
// A checkout is only marked failed once PayMongo can't take a payment for it any more.
//
// reason is why it's ending: 'cancelled' (the customer came back without paying), 'replaced'
// (they started another checkout), 'expired' (the hold ran out, see paymentReconciliation.js) or
// 'payment_failed' (PayMongo's webhook). Answers in /status's shape.
export async function settleUnpaidCheckout(pending, reason, req = null) {
  if (pending.status === 'succeeded') return { status: 'succeeded', order: await finalizePendingCheckout(pending, req) };
  if (pending.status === 'failed') return { status: 'failed', error: checkoutFailureMessage(pending.failure_reason) };

  if (pending.paymongo_checkout_session_id) {
    const sessionId = pending.paymongo_checkout_session_id;
    let session = await retrieveCheckoutSession(sessionId);
    if (!session.paid && session.status !== 'expired') {
      try {
        await expireCheckoutSession(sessionId);
        session = { ...session, status: 'expired' };
      } catch {
        // Refused: it was paid a moment ago, or a payment on it is still going through.
        session = await retrieveCheckoutSession(sessionId);
      }
    }
    if (session.paid) {
      await rememberPaymentIntent(pending, session.paymentIntentId);
      return { status: 'succeeded', order: await finalizePendingCheckout(pending, req) };
    }
    if (session.status !== 'expired') return { status: 'processing' };

    await closeCheckout(pending.id, reason);
    return { status: 'failed', error: checkoutFailureMessage(reason) };
  }

  if (pending.paymongo_payment_intent_id) {
    const intent = await retrievePaymentIntent(pending.paymongo_payment_intent_id);
    if (intent.status === 'succeeded') return { status: 'succeeded', order: await finalizePendingCheckout(pending, req) };
    // Declined. A checkout never tries its card again; retrying starts a new checkout.
    if (intent.status === 'awaiting_payment_method' && intent.errorMessage) {
      await closeCheckout(pending.id, 'declined');
      return { status: 'failed', error: intent.errorMessage };
    }
  }

  // A card payment intent can't be called off the way a session can, and a checkout with nothing
  // at PayMongo yet may still be getting its session, so these stay open and only their units go
  // back on sale. If one is paid after all, its order still gets made, from whatever stock is left.
  await releaseHeldStock(pending.id);
  return { status: 'processing' };
}

// A checkout this customer left unpaid (backed out of PayMongo's page, closed it, or never
// finished a 3-D Secure page) still holds its units, so it's ended before a new one starts.
// Otherwise retrying the same order would be refused against the customer's own hold.
async function settleOwnUnpaidCheckouts(req) {
  const held = await db.prepare("SELECT * FROM pending_checkouts WHERE user_id = ? AND status = 'pending' AND stock_held = 1").all(req.user.id);
  for (const pending of held) {
    try {
      await settleUnpaidCheckout(pending, 'replaced', req);
    } catch (err) {
      console.error(`[checkout] couldn't end checkout ${pending.id}:`, err.message);
    }
  }
}

// Prices the cart server-side, sets its units aside and stashes it in pending_checkouts — the
// real order can't be created until PayMongo confirms the charge. The units are taken now, when
// the customer confirms, so whoever confirms first gets them and anyone after is told what's
// left before PayMongo charges them (checkoutStock.js).
async function createPendingCheckout(req, paymentMethod) {
  const { items, shippingAddress, promoCode } = req.body;
  await settleOwnUnpaidCheckouts(req);
  const { orderItems, subtotal, discount, shippingFee, tax, taxRate, total, appliedPromo } = await validateAndPriceCart(items, promoCode);
  const pricedItems = orderItems.map(oi => ({ productId: oi.product.id, quantity: oi.quantity, price: oi.price }));

  const pendingId = uuid();
  await withTransaction(async (tx) => {
    await holdStock(tx, pricedItems);
    await tx.prepare(`
      INSERT INTO pending_checkouts (id, user_id, items, subtotal, discount, shipping_fee, tax, tax_rate, total, payment_method, shipping_address, promo_code, applied_promo, stock_held)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)
    `).run(pendingId, req.user.id, JSON.stringify(pricedItems), subtotal, discount, shippingFee, tax, taxRate, total, paymentMethod, shippingAddress, promoCode || null, appliedPromo);
  });

  return { pendingId, orderItems, total };
}

// A "Buy Now" checkout orders one product straight from its page, bypassing the cart. Every
// redirect carries that along so cancelling returns to the same single-item checkout (not the
// full cart), and a successful return knows not to clear the customer's cart.
function buyNowQueryFor(buyNow, orderItems) {
  return buyNow && orderItems.length === 1
    ? `buy=${encodeURIComponent(orderItems[0].product.slug)}&qty=${orderItems[0].quantity}`
    : '';
}

// A card entered on our own checkout page is charged right here, with no stop at PayMongo's
// hosted page. The browser has already turned the card details into a PayMongo payment method
// using the public key (frontend/src/api/paymongo.js), so the card number and CVC never reach
// this server — only that payment method's id does. Most cards are charged on the spot and the
// order comes back in this same response. A card whose bank asks for 3-D Secure gets a
// redirectUrl to the bank's page instead, which lands back on /checkout/return to be polled.
router.post('/card-payment', authenticate, async (req, res) => {
  try {
    const { paymentMethodId, buyNow } = req.body;
    if (!paymentMethodId) return res.status(400).json({ error: 'paymentMethodId is required' });
    if (!(await getEnabledGatewayMethods()).includes('card')) {
      return res.status(400).json({ error: 'Card payments are currently unavailable. Please choose another method.' });
    }

    const { pendingId, orderItems, total } = await createPendingCheckout(req, 'card');
    const buyNowQuery = buyNowQueryFor(buyNow, orderItems);

    let intent;
    try {
      intent = await createPaymentIntent({
        amount: Math.round(total * 100),
        description: `HomeLink order (checkout ${pendingId})`,
        metadata: { pending_checkout_id: pendingId, user_id: req.user.id },
        idempotencyKey: pendingId,
      });
    } catch (err) {
      await closeCheckout(pendingId, 'gateway_error');
      throw err;
    }
    await db.prepare('UPDATE pending_checkouts SET paymongo_payment_intent_id = ? WHERE id = ?').run(intent.id, pendingId);

    let outcome;
    try {
      outcome = await attachPaymentIntent(intent.id, {
        paymentMethodId,
        returnUrl: `${resolveFrontendUrl(req)}/checkout/return?pcid=${pendingId}${buyNowQuery ? `&${buyNowQuery}` : ''}`,
      });
    } catch (err) {
      // PayMongo refused the attach outright, so nothing was charged.
      await closeCheckout(pendingId, 'declined');
      throw err;
    }

    if (outcome.status === 'succeeded') {
      const pending = await db.prepare('SELECT * FROM pending_checkouts WHERE id = ?').get(pendingId);
      const order = await finalizePendingCheckout(pending, req);
      return res.status(201).json({ status: 'succeeded', order });
    }
    if (outcome.status === 'awaiting_next_action' && outcome.redirectUrl) {
      return res.json({ status: 'requires_action', pendingCheckoutId: pendingId, redirectUrl: outcome.redirectUrl });
    }
    if (outcome.status === 'processing') {
      return res.json({ status: 'processing', pendingCheckoutId: pendingId });
    }

    // awaiting_payment_method: the card was declined.
    await closeCheckout(pendingId, 'declined');
    res.status(402).json({ error: outcome.errorMessage || 'Your card was declined. Please check the details or try another card.' });
  } catch (err) {
    sendCheckoutError(res, err);
  }
});

// GCash and QR Ph (and a saved card, which HomeLink only knows the last 4 digits of) go through
// PayMongo's hosted Checkout Session (v2) — the browser is sent straight to PayMongo's
// checkout_url, which collects the actual payment details (card number, GCash login, QR scan)
// itself. v2 defers creating the underlying payment intent until the customer actually pays,
// so only the checkout_session_id is known up front — /status polls that until a payment
// shows up as paid.
router.post('/checkout-session', authenticate, async (req, res) => {
  try {
    const { paymentMethod, buyNow } = req.body;
    if (!['card', 'gcash', 'qrph'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod must be "card", "gcash", or "qrph"' });
    }
    if (!(await getEnabledGatewayMethods()).includes(paymentMethod)) {
      return res.status(400).json({ error: 'That payment method is currently unavailable. Please choose another.' });
    }

    const { pendingId, orderItems, total } = await createPendingCheckout(req, paymentMethod);

    const frontendUrl = resolveFrontendUrl(req);
    const buyNowQuery = buyNowQueryFor(buyNow, orderItems);
    const pcidQuery = `pcid=${pendingId}${buyNowQuery ? `&${buyNowQuery}` : ''}`;
    let session;
    try {
      const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      session = await createCheckoutSessionV2({
        amount: Math.round(total * 100),
        paymentMethodTypes: [paymentMethod],
        lineItemName: 'HomeLink order',
        description: `HomeLink order (checkout ${pendingId})`,
        successUrl: `${frontendUrl}/checkout/return?${pcidQuery}`,
        // The checkout page sees pcid and calls /cancel, which puts the held units back on sale
        // straight away rather than after the hold runs out.
        cancelUrl: `${frontendUrl}/checkout?${pcidQuery}`,
        billingName: `${user.first_name} ${user.last_name}`,
        billingEmail: user.email,
        referenceNumber: pendingId,
        metadata: { pending_checkout_id: pendingId, user_id: req.user.id },
        idempotencyKey: pendingId,
      });
    } catch (err) {
      await closeCheckout(pendingId, 'gateway_error');
      throw err;
    }

    await db.prepare('UPDATE pending_checkouts SET paymongo_checkout_session_id = ? WHERE id = ?').run(session.id, pendingId);

    res.status(201).json({ pendingCheckoutId: pendingId, checkoutUrl: session.checkoutUrl });
  } catch (err) {
    sendCheckoutError(res, err);
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
      return res.json({ status: 'failed', error: checkoutFailureMessage(pending.failure_reason) });
    }

    // An inline card payment (/card-payment) has no checkout session, only its own payment
    // intent — polled here after the customer comes back from their bank's 3-D Secure page.
    if (!pending.paymongo_checkout_session_id) {
      if (!pending.paymongo_payment_intent_id) return res.json({ status: 'failed' });
      const intent = await retrievePaymentIntent(pending.paymongo_payment_intent_id);
      if (intent.status === 'succeeded') {
        const order = await finalizePendingCheckout(pending, req);
        return res.json({ status: 'succeeded', order });
      }
      if (intent.status === 'awaiting_payment_method') {
        await closeCheckout(pending.id, 'declined');
        return res.json({ status: 'failed', error: intent.errorMessage || 'Your bank didn\'t approve this payment.' });
      }
      return res.json({ status: 'processing' });
    }

    const session = await retrieveCheckoutSession(pending.paymongo_checkout_session_id);
    if (session.paid) {
      if (session.paymentIntentId && session.paymentIntentId !== pending.paymongo_payment_intent_id) {
        await db.prepare('UPDATE pending_checkouts SET paymongo_payment_intent_id = ? WHERE id = ?').run(session.paymentIntentId, pending.id);
        pending.paymongo_payment_intent_id = session.paymentIntentId;
      }
      const order = await finalizePendingCheckout(pending, req);
      return res.json({ status: 'succeeded', order });
    }
    // Not paid yet — PayMongo's hosted page lets the customer retry a declined/expired
    // attempt in place rather than bouncing them back to us, so there's no reliable "failed"
    // signal to poll for here. The frontend's own poll cap handles abandonment gracefully.
    return res.json({ status: 'processing' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The customer came back from PayMongo without paying: its cancel link, or the APK's payment tab
// closed. Their held units go back on sale now instead of when the hold runs out — unless the
// checkout turns out to be paid, or a payment on it is still going through. Answers like /status.
router.post('/cancel/:pendingCheckoutId', authenticate, async (req, res) => {
  try {
    const pending = await db.prepare('SELECT * FROM pending_checkouts WHERE id = ? AND user_id = ?').get(req.params.pendingCheckoutId, req.user.id);
    if (!pending) return res.status(404).json({ error: 'Checkout not found' });
    res.json(await settleUnpaidCheckout(pending, 'cancelled', req));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Not mounted on this router — needs raw-body middleware ahead of express.json(), see server.js.
//
// PayMongo's envelope has shifted between webhook generations, so both shapes are checked
// defensively rather than assumed: the classic form nests the event under
// data.attributes.{type,data}, while checkout_session.* events put it directly under
// data.{type,data}. Either way, `reference_number`/`metadata` on the checkout session is our
// own pendingId, so this event type doesn't need a payment_intent_id already on file the way
// the generic payment.* events do — it's the primary confirmation path for the v2 flow, with
// /status polling (and, redundantly, the generic events once payment_intent_id is known) as
// backup.
export async function paymongoWebhookHandler(req, res) {
  try {
    const signature = req.headers['paymongo-signature'];
    const rawBody = req.body.toString('utf8');
    const valid = verifyWebhookSignature(rawBody, signature, process.env.PAYMONGO_WEBHOOK_SECRET);
    if (!valid) return res.status(401).json({ error: 'Invalid webhook signature' });

    const event = JSON.parse(rawBody);
    const eventType = event?.data?.type || event?.data?.attributes?.type;
    const eventPayload = event?.data?.data || event?.data?.attributes?.data;

    console.log(`[PayMongo webhook] ${eventType}:`, JSON.stringify(eventPayload));

    if (eventType === 'checkout_session.payment.paid') {
      const pendingId = eventPayload?.attributes?.reference_number || eventPayload?.attributes?.metadata?.pending_checkout_id || eventPayload?.attributes?.metadata?.pending_booking_id;
      const paymentIntentId = eventPayload?.attributes?.payment_intent?.id || null;
      if (!pendingId) return res.status(200).json({ received: true });

      const pendingCheckout = await db.prepare('SELECT * FROM pending_checkouts WHERE id = ?').get(pendingId);
      const pendingBooking = pendingCheckout ? null : await db.prepare('SELECT * FROM pending_bookings WHERE id = ?').get(pendingId);
      const pending = pendingCheckout || pendingBooking;
      if (!pending || pending.status !== 'pending') return res.status(200).json({ received: true });

      if (paymentIntentId && paymentIntentId !== pending.paymongo_payment_intent_id) {
        const table = pendingCheckout ? 'pending_checkouts' : 'pending_bookings';
        await db.prepare(`UPDATE ${table} SET paymongo_payment_intent_id = ? WHERE id = ?`).run(paymentIntentId, pending.id);
        pending.paymongo_payment_intent_id = paymentIntentId;
      }

      await (pendingCheckout ? finalizePendingCheckout(pending, null) : finalizePendingBooking(pending, null));
    } else if (eventType === 'payment.paid' || eventType === 'payment.failed') {
      const paymentIntentId = eventPayload?.attributes?.payment_intent_id || eventPayload?.attributes?.payment_intent?.id;
      if (!paymentIntentId) return res.status(200).json({ received: true });

      // A payment intent belongs to exactly one of the two pending tables (orders vs. service
      // bookings) — check both since the webhook fires for either kind of checkout. Only
      // reachable once paymongo_payment_intent_id has already been backfilled (by /status or
      // by the checkout_session.payment.paid event above), since that's the only way we learn
      // it under the deferred-intent v2 flow.
      const pendingCheckout = await db.prepare('SELECT * FROM pending_checkouts WHERE paymongo_payment_intent_id = ?').get(paymentIntentId);
      const pendingBooking = pendingCheckout ? null : await db.prepare('SELECT * FROM pending_bookings WHERE paymongo_payment_intent_id = ?').get(paymentIntentId);
      const pending = pendingCheckout || pendingBooking;
      if (!pending || pending.status !== 'pending') return res.status(200).json({ received: true });

      if (eventType === 'payment.paid') {
        await (pendingCheckout ? finalizePendingCheckout(pending, null) : finalizePendingBooking(pending, null));
      } else if (pendingCheckout) {
        // Also hands its held units back, once PayMongo can't take a payment for it any more.
        await settleUnpaidCheckout(pending, 'payment_failed', null);
      } else {
        await db.prepare("UPDATE pending_bookings SET status = 'failed' WHERE id = ?").run(pending.id);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('PayMongo webhook error:', err.message);
    res.status(200).json({ received: true });
  }
}

export default router;
