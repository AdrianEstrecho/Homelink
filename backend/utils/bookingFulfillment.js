import { v4 as uuid } from 'uuid';
import db, { withTransaction } from '../db/database.js';
import { bookingConfirmationEmail } from './email.js';
import { logActivity } from './audit.js';

export const SLOT_TAKEN_ERROR = 'That time slot was just booked by someone else. Please choose another time.';

// A time slot belongs to one customer: they can book several services in it ("Add Another
// Service" books them all at the same date and time), but no other customer can take it —
// the same rule GET /bookings/availability shows. Pass a transaction's executor to check it
// under that transaction's slot lock.
export async function isSlotTakenByAnotherCustomer(scheduledDate, scheduledTime, userId, executor = db) {
  const row = await executor.prepare(`
    SELECT 1 FROM bookings
    WHERE scheduled_date = ? AND scheduled_time = ? AND status <> 'cancelled' AND user_id <> ?
    LIMIT 1
  `).get(scheduledDate, scheduledTime, userId);
  return !!row;
}

// The single place a booking actually gets created — mirrors fulfillOrder(). Reused by
// bank-transfer bookings (immediate, 'pending') and the webhook/poll-confirmed path for
// card and GCash ('paid'), so payment_status always reflects a real, gateway-verified charge
// (or an explicit manual-verification pending state) rather than being assumed.
//
// The slot check and the insert run in one transaction holding an advisory lock on that date
// and time, so two customers submitting the same slot at the same moment go one after the
// other and the second one sees the first one's booking. Like orders, what happens then depends
// on whether the money is already captured: an unpaid (bank transfer) booking is refused with a
// 409, while a paid PayMongo booking is still created and flagged needs_review for rescheduling.
//
// pendingBookingId (PayMongo path only) is claimed inside that same transaction, so a webhook
// and a /status poll confirming the same payment together create one booking, not two.
export async function fulfillBooking({
  userId, serviceId, scheduledDate, scheduledTime, address, notes, price, discount,
  paymentMethod, paymentStatus, paymongoPaymentIntentId, paymongoPaymentId,
}, actorReq, pendingBookingId = null) {
  const service = await db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const paid = paymentStatus === 'paid';

  const { id, alreadyCreated, reviewReason } = await withTransaction(async (tx) => {
    if (pendingBookingId) {
      const pending = await tx.prepare('SELECT booking_id FROM pending_bookings WHERE id = ? FOR UPDATE').get(pendingBookingId);
      if (pending?.booking_id) return { id: pending.booking_id, alreadyCreated: true, reviewReason: null };
    }

    // Released automatically at COMMIT/ROLLBACK. Keyed on the slot rather than a row, since the
    // row that would conflict doesn't exist yet.
    await tx.prepare('SELECT pg_advisory_xact_lock(hashtext(?))').get(`booking-slot:${scheduledDate} ${scheduledTime}`);
    const taken = await isSlotTakenByAnotherCustomer(scheduledDate, scheduledTime, userId, tx);
    if (taken && !paid) {
      const err = new Error(SLOT_TAKEN_ERROR);
      err.status = 409;
      throw err;
    }
    const reviewReason = taken
      ? `The ${scheduledDate} ${scheduledTime} slot was booked by another customer while this customer was paying — reschedule with them`
      : null;

    const id = uuid();
    await tx.prepare(`
      INSERT INTO bookings (id, user_id, service_id, scheduled_date, scheduled_time, address, notes, price, discount, payment_status, payment_method, paymongo_payment_intent_id, paymongo_payment_id, needs_review, review_reason)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(id, userId, serviceId, scheduledDate, scheduledTime, address, notes || '', price, discount, paymentStatus, paymentMethod, paymongoPaymentIntentId || null, paymongoPaymentId || null, taken ? 1 : 0, reviewReason);

    if (pendingBookingId) {
      await tx.prepare("UPDATE pending_bookings SET status = 'succeeded', booking_id = ? WHERE id = ?").run(id, pendingBookingId);
    }

    return { id, alreadyCreated: false, reviewReason };
  });

  const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
  // Joined in so the confirmation UI (and GET /bookings/status) can render a receipt without
  // a second round-trip — matches the shape GET /bookings/my already returns.
  const receipt = { ...booking, service_name: service.name, service_category: service.category, service_image: service.image };

  if (alreadyCreated) return receipt;

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

  if (reviewReason) {
    await logActivity(actorReq, 'booking.needs_review', 'booking', id, {
      customerName: `${user.first_name} ${user.last_name}`,
      reason: reviewReason,
    });
  }

  return receipt;
}
