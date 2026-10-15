// Talks directly to PayMongo from the browser using the *public* key, so a card typed into our
// checkout page goes straight to PayMongo and never touches our own backend. Our server only
// ever sees the resulting payment method id (see POST /payments/card-payment), which it then
// charges with the secret key.
const PUBLIC_KEY = import.meta.env.VITE_PAYMONGO_PUBLIC_KEY;

// Without a public key a card can't be tokenized here, so checkout falls back to PayMongo's
// hosted page for cards too.
export const canChargeCardsInline = Boolean(PUBLIC_KEY);

// PayMongo's own wording ("details.card_number format is invalid.") reads like an API error,
// so the fields a customer can actually fix get plainer messages.
function friendlyCardError(error) {
  const field = error?.source?.attribute || '';
  if (field.includes('card_number')) return 'Enter a valid card number';
  if (field.includes('exp_month') || field.includes('exp_year')) return 'Check the card\'s expiry date';
  if (field.includes('cvc')) return 'Enter a valid CVC';
  return error?.detail || 'We couldn\'t verify this card. Please check the details and try again.';
}

export async function createCardPaymentMethod({ cardNumber, expMonth, expYear, cvc, billing }) {
  const res = await fetch('https://api.paymongo.com/v1/payment_methods', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + btoa(`${PUBLIC_KEY}:`),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          type: 'card',
          details: { card_number: cardNumber, exp_month: expMonth, exp_year: expYear, cvc },
          billing,
        },
      },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(friendlyCardError(json?.errors?.[0]));
  return json.data.id;
}
