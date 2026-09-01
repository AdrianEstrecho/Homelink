import { api } from '../api/client';
import { createPaymentMethod, attachPaymentIntent } from '../api/paymongo';

// Drives one service through PayMongo card/GCash checkout — mirrors the card/GCash branch
// of Checkout.jsx's handleConfirmOrder(), but for a single service booking rather than a
// whole cart. Resolves in place when PayMongo confirms synchronously (typical for card);
// otherwise redirects the browser out to authorize (always true for GCash, occasionally for
// 3DS-challenged cards) and never returns — BookingReturn.jsx picks the flow back up once
// PayMongo sends the browser back to /bookings/return.
export async function startBookingPayment({ serviceId, scheduledDate, scheduledTime, address, notes, paymentMethod, cardDetails, gcashNumber, user }) {
  const { pendingBookingId, paymentIntentId, clientKey } = await api.post('/bookings/intent', {
    serviceId, scheduledDate, scheduledTime, address, notes, paymentMethod,
  });

  const billing = {
    name: user ? `${user.firstName} ${user.lastName}` : undefined,
    email: user?.email,
    phone: paymentMethod === 'gcash' ? gcashNumber : user?.phone,
  };

  const paymentMethodId = paymentMethod === 'card'
    ? await createPaymentMethod({
        type: 'card',
        details: {
          card_number: cardDetails.cardNumber,
          exp_month: cardDetails.expMonth,
          exp_year: cardDetails.expYear,
          cvc: cardDetails.cvc,
        },
        billing,
      })
    : await createPaymentMethod({ type: 'gcash', billing });

  const returnUrl = `${window.location.origin}/bookings/return?pbid=${pendingBookingId}`;
  const attached = await attachPaymentIntent({ paymentIntentId, paymentMethodId, clientKey, returnUrl });

  if (attached.status === 'succeeded') {
    const result = await api.get(`/bookings/status/${pendingBookingId}`);
    return { type: 'succeeded', booking: result.booking };
  }
  if (attached.nextAction?.redirect?.url) {
    window.location.href = attached.nextAction.redirect.url;
    return { type: 'redirect' };
  }
  throw new Error(attached.lastPaymentError?.detail || 'Payment could not be completed. Please try again.');
}
