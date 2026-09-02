import crypto from 'crypto';

const API_BASE = 'https://api.paymongo.com/v1';

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

// Creates a PayMongo-hosted Checkout Session — PayMongo's own page collects the actual
// payment details (card number, GCash login, QR scan) and renders whatever UI that method
// needs, instead of us building it. Under the hood it mints a regular payment intent, so the
// id returned here plugs into the same pending_checkouts/pending_bookings + webhook/poll flow
// every payment method already uses — the only difference is the customer pays on checkout_url
// instead of inline. `paymentMethodTypes` restricts the hosted page to the one method the
// customer picked in our own PaymentMethodPicker (e.g. ['card'], ['gcash'], or ['qrph']).
export async function createCheckoutSession({ amount, paymentMethodTypes, lineItemName, description, successUrl, cancelUrl, billingName, billingEmail, referenceNumber, metadata, idempotencyKey }) {
  const session = await paymongoFetch('/checkout_sessions', {
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
    paymentIntentId: session.attributes.payment_intent.id,
    status: session.attributes.status,
  };
}

export async function retrievePaymentIntent(paymentIntentId) {
  const intent = await paymongoFetch(`/payment_intents/${paymentIntentId}`, { method: 'GET' });
  return {
    id: intent.id,
    status: intent.attributes.status,
    nextAction: intent.attributes.next_action || null,
    lastPaymentError: intent.attributes.last_payment_error || null,
    payments: intent.attributes.payments || [],
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
