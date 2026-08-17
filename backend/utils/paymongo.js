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

export async function createPaymentIntent({ amount, paymentMethodAllowed, description, metadata, idempotencyKey }) {
  const intent = await paymongoFetch('/payment_intents', {
    method: 'POST',
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    body: JSON.stringify({
      data: {
        attributes: {
          amount,
          currency: 'PHP',
          payment_method_allowed: paymentMethodAllowed,
          description,
          metadata,
        },
      },
    }),
  });
  return { id: intent.id, clientKey: intent.attributes.client_key, status: intent.attributes.status };
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
