import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { bookingConfirmationEmail } from './email.js';
import { logActivity } from './audit.js';

// The single place a booking actually gets created — mirrors fulfillOrder(). Reused by
// bank-transfer bookings (immediate, 'pending') and the webhook/poll-confirmed path for
// card and GCash ('paid'), so payment_status always reflects a real, gateway-verified charge
// (or an explicit manual-verification pending state) rather than being assumed.
export async function fulfillBooking({
  userId, serviceId, scheduledDate, scheduledTime, address, notes, price, discount,
  paymentMethod, paymentStatus, paymongoPaymentIntentId, paymongoPaymentId,
}, actorReq) {
  const service = await db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const id = uuid();

  await db.prepare(`
    INSERT INTO bookings (id, user_id, service_id, scheduled_date, scheduled_time, address, notes, price, discount, payment_status, payment_method, paymongo_payment_intent_id, paymongo_payment_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, userId, serviceId, scheduledDate, scheduledTime, address, notes || '', price, discount, paymentStatus, paymentMethod, paymongoPaymentIntentId || null, paymongoPaymentId || null);

  const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);

  // Already committed at this point, so email sending must not block or fail the response
  // to the customer — fire it and log failures async.
  if (user.notify_bookings) {
    bookingConfirmationEmail(booking, service, user).catch((emailErr) => {
      console.error(`Failed to send booking confirmation email for booking ${id}:`, emailErr.message);
    });
  }

  await logActivity(actorReq, 'booking.create', 'booking', id, {
    customerName: `${user.first_name} ${user.last_name}`,
    serviceName: service.name,
    scheduledDate,
  });

  // Joined in so the confirmation UI (and GET /bookings/status) can render a receipt without
  // a second round-trip — matches the shape GET /bookings/my already returns.
  return { ...booking, service_name: service.name, service_category: service.category, service_image: service.image };
}
