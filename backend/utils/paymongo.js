import crypto from 'crypto';

const API_BASE = 'https://api.paymongo.com';

function authHeader() {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) throw new Error('PAYMONGO_SECRET_KEY is not configured');
  return 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
}

async function paymongoFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.errors?.[0]?.detail || `PayMongo request failed (${res.status})`;
    throw new Error(detail);
  }
  return data.data;
}

// Creates a PayMongo-hosted Checkout Session (v2) — PayMongo's own page collects the actual
// payment details (card number, GCash login, QR scan) and renders whatever UI that method
// needs, instead of us building it. Unlike v1, v2 defers creating the underlying payment
// intent until the customer actually picks a method and pays, so the response here only ever
// has an id + checkout_url — no payment intent to stash yet. `paymentMethodTypes` restricts
// the hosted page to the one method the customer picked in our own PaymentMethodPicker (e.g.
// ['card'], ['gcash'], or ['qrph']).
export async function createCheckoutSessionV2({ amount, paymentMethodTypes, lineItemName, description, successUrl, cancelUrl, billingName, billingEmail, referenceNumber, metadata, idempotencyKey }) {
  const session = await paymongoFetch('/v2/checkout_sessions', {
    method: 'POST',
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    body: JSON.stringify({
      data: {
        attributes: {
          cancel_url: cancelUrl,
          success_url: successUrl,
          billing: (billingName || billingEmail) ? { name: billingName, email: billingEmail } : undefined,
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          line_items: [{ amount, currency: 'PHP', description: lineItemName, name: lineItemName, quantity: 1 }],
          payment_method_types: paymentMethodTypes,
          description,
          reference_number: referenceNumber,
          metadata,
        },
      },
    }),
  });
  return {
    id: session.id,
    checkoutUrl: session.attributes.checkout_url,
  };
}

// v2 has no GET /v2/checkout_sessions/:id — retrieval still goes through the v1 path, which
// works fine for sessions created via v2 (same underlying resource). Once paid, `payments`
// holds one entry per attempt and `payment_intent` is populated (both null/empty before that).
export async function retrieveCheckoutSession(checkoutSessionId) {
  const session = await paymongoFetch(`/v1/checkout_sessions/${checkoutSessionId}`, { method: 'GET' });
  const payments = session.attributes.payments || [];
  return {
    id: session.id,
    paid: payments.some(p => p.attributes.status === 'paid'),
    paymentIntentId: session.attributes.payment_intent?.id || null,
    payments,
  };
}

export function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  // Paymongo-Signature looks like "t=<timestamp>,te=<test-sig>,li=<live-sig>" — only one of
  // te/li is meaningful per mode, and both are HMAC-SHA256("<timestamp>.<rawBody>", secret).
  const parts = Object.fromEntries(signatureHeader.split(',').map(p => p.split('=')));
  const timestamp = parts.t;
  const providedSig = parts.li || parts.te;
  if (!timestamp || !providedSig) return false;

  const expectedSig = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

  const expectedBuf = Buffer.from(expectedSig);
  const providedBuf = Buffer.from(providedSig);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
