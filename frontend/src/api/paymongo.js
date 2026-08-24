// Talks directly to PayMongo from the browser using the *public* key — card/GCash details
// entered in PaymentMethodPicker go straight here and never touch our own backend. Our
// server only ever sees the resulting payment_method id (see api/client.js `/payments/intent`).
const PAYMONGO_API = 'https://api.paymongo.com/v1';
const PUBLIC_KEY = import.meta.env.VITE_PAYMONGO_PUBLIC_KEY;

async function paymongoRequest(path, body) {
  const res = await fetch(`${PAYMONGO_API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + btoa(`${PUBLIC_KEY}:`),
    },
    body: JSON.stringify({ data: { attributes: body } }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.errors?.[0]?.detail || 'Payment request failed');
  }
  return json.data;
}

export async function createPaymentMethod({ type, details, billing }) {
  const pm = await paymongoRequest('/payment_methods', { type, details, billing });
  return pm.id;
}

export async function attachPaymentIntent({ paymentIntentId, paymentMethodId, clientKey, returnUrl }) {
  const intent = await paymongoRequest(`/payment_intents/${paymentIntentId}/attach`, {
    payment_method: paymentMethodId,
    client_key: clientKey,
    return_url: returnUrl,
  });
  return {
    status: intent.attributes.status,
    nextAction: intent.attributes.next_action || null,
    lastPaymentError: intent.attributes.last_payment_error || null,
  };
}
