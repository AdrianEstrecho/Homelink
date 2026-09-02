import { api } from '../api/client';

// Drives one service through PayMongo checkout — mirrors Checkout.jsx's handleConfirmOrder(),
// but for a single service booking rather than a whole cart. Card, GCash, and QR Ph all hand
// off to PayMongo's hosted Checkout Session (PayMongo's own page collects the actual payment
// details) and never return — BookingReturn.jsx picks the flow back up once PayMongo sends the
// browser back to /bookings/return.
export async function startBookingPayment({ serviceId, scheduledDate, scheduledTime, address, notes, paymentMethod }) {
  const { checkoutUrl } = await api.post('/bookings/checkout-session', {
    serviceId, scheduledDate, scheduledTime, address, notes, paymentMethod,
  });
  window.location.href = checkoutUrl;
}
