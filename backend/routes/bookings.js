import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { getFirstTimeServiceDiscount, getHolidayDiscount, calculateDiscount } from '../utils/promos.js';
import { fulfillBooking } from '../utils/bookingFulfillment.js';
import { createCheckoutSessionV2, retrieveCheckoutSession } from '../utils/paymongo.js';
import { logActivity } from '../utils/audit.js';

const router = Router();

router.get('/availability', async (req, res) => {
  const { date } = req.query;
  const slots = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
  const booked = await db.prepare('SELECT scheduled_time FROM bookings WHERE scheduled_date = ? AND status NOT IN (\'cancelled\')').all(date || new Date().toISOString().split('T')[0]);
  const bookedTimes = booked.map(b => b.scheduled_time);
  res.json(slots.map(time => ({ time, available: !bookedTimes.includes(time) })));
});

router.get('/discount-preview', authenticate, async (req, res) => {
  res.json({
    firstTime: await getFirstTimeServiceDiscount(req.user.id),
    holiday: getHolidayDiscount(),
  });
});

// Shared by the bank-transfer path and /checkout-session so both price a booking the same way.
async function priceService(serviceId, userId) {
  const service = await db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  if (!service) return null;

  let price = service.base_price;
  let discount = 0;
  const firstTime = await getFirstTimeServiceDiscount(userId);
  if (firstTime) discount += calculateDiscount(price, firstTime);
  const holiday = getHolidayDiscount();
  if (holiday) discount += calculateDiscount(price - discount, holiday);
  price = Math.max(0, price - discount);

  return { service, price, discount };
}

// Reconstructs a bookings.create-shaped row from a pending_bookings row and fulfills it —
// mirrors finalizePendingCheckout() in payments.js. Exported so the shared PayMongo webhook
// handler can finalize card/GCash/QR Ph bookings the same way it finalizes product orders.
export async function finalizePendingBooking(pending, req) {
  if (pending.booking_id) {
    return await db.prepare(`
      SELECT b.*, s.name as service_name, s.category as service_category, s.image as service_image,
      e.first_name as employee_first_name, e.last_name as employee_last_name
      FROM bookings b JOIN services s ON b.service_id = s.id
      LEFT JOIN users e ON b.employee_id = e.id
      WHERE b.id = ?
    `).get(pending.booking_id);
  }

  const booking = await fulfillBooking({
    userId: pending.user_id,
    serviceId: pending.service_id,
    scheduledDate: pending.scheduled_date,
    scheduledTime: pending.scheduled_time,
    address: pending.address,
    notes: pending.notes,
    price: pending.price,
    discount: pending.discount,
    paymentMethod: pending.payment_method,
    paymentStatus: 'paid',
    paymongoPaymentIntentId: pending.paymongo_payment_intent_id,
  }, req || { user: { id: pending.user_id }, ip: null });

  await db.prepare("UPDATE pending_bookings SET status = 'succeeded', booking_id = ? WHERE id = ?").run(booking.id, pending.id);

  return booking;
}

// Only bank transfer goes through this endpoint — it's manual/informational, so the booking
// is created immediately with payment_status 'pending' until an admin verifies the deposit.
// Card, GCash, and QR Ph are real, gateway-verified charges and must go through
// /api/bookings/checkout-session, which only creates the booking once PayMongo confirms the
// payment actually succeeded.
router.post('/', authenticate, async (req, res) => {
  try {
    const { serviceId, scheduledDate, scheduledTime, address, notes, paymentMethod } = req.body;
    if (paymentMethod !== 'bank') {
      return res.status(400).json({ error: 'Use /api/bookings/checkout-session for card, GCash, or QR Ph checkout' });
    }

    const priced = await priceService(serviceId, req.user.id);
    if (!priced) return res.status(404).json({ error: 'Service not found' });

    const booking = await fulfillBooking({
      userId: req.user.id,
      serviceId,
      scheduledDate,
      scheduledTime,
      address,
      notes,
      price: priced.price,
      discount: priced.discount,
      paymentMethod: 'bank',
      paymentStatus: 'pending',
    }, req);

    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Card, GCash, and QR Ph all go through PayMongo's hosted Checkout Session (v2) — the browser
// is sent straight to PayMongo's checkout_url, which collects the actual payment details (card
// number, GCash login, QR scan) itself. We never see or store raw card/GCash credentials this
// way, which keeps HomeLink out of PCI-DSS scope entirely. v2 defers creating the underlying
// payment intent until the customer actually pays, so only the checkout_session_id is known
// up front — /status polls that until a payment shows up as paid.
router.post('/checkout-session', authenticate, async (req, res) => {
  try {
    const { serviceId, scheduledDate, scheduledTime, address, notes, paymentMethod } = req.body;
    if (!['card', 'gcash', 'qrph'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod must be "card", "gcash", or "qrph"' });
    }
    if (!scheduledDate || !scheduledTime || !address) {
      return res.status(400).json({ error: 'scheduledDate, scheduledTime, and address are required' });
    }

    const priced = await priceService(serviceId, req.user.id);
    if (!priced) return res.status(404).json({ error: 'Service not found' });

    const pendingId = uuid();
    await db.prepare(`
      INSERT INTO pending_bookings (id, user_id, service_id, scheduled_date, scheduled_time, address, notes, price, discount, payment_method)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(pendingId, req.user.id, serviceId, scheduledDate, scheduledTime, address, notes || '', priced.price, priced.discount, paymentMethod);

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await createCheckoutSessionV2({
      amount: Math.round(priced.price * 100),
      paymentMethodTypes: [paymentMethod],
      lineItemName: priced.service.name,
      description: `HomeLink service booking (checkout ${pendingId})`,
      successUrl: `${frontendUrl}/bookings/return?pbid=${pendingId}`,
      cancelUrl: `${frontendUrl}/services/${priced.service.slug}/book`,
      billingName: `${user.first_name} ${user.last_name}`,
      billingEmail: user.email,
      referenceNumber: pendingId,
      metadata: { pending_booking_id: pendingId, user_id: req.user.id },
      idempotencyKey: pendingId,
    });

    await db.prepare('UPDATE pending_bookings SET paymongo_checkout_session_id = ? WHERE id = ?').run(session.id, pendingId);

    res.status(201).json({ pendingBookingId: pendingId, checkoutUrl: session.checkoutUrl });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/status/:pendingBookingId', authenticate, async (req, res) => {
  try {
    const pending = await db.prepare('SELECT * FROM pending_bookings WHERE id = ? AND user_id = ?').get(req.params.pendingBookingId, req.user.id);
    if (!pending) return res.status(404).json({ error: 'Booking checkout not found' });

    if (pending.status === 'succeeded') {
      const booking = await finalizePendingBooking(pending, req);
      return res.json({ status: 'succeeded', booking });
    }
    if (pending.status === 'failed') {
      return res.json({ status: 'failed' });
    }

    const session = await retrieveCheckoutSession(pending.paymongo_checkout_session_id);
    if (session.paid) {
      if (session.paymentIntentId && session.paymentIntentId !== pending.paymongo_payment_intent_id) {
        await db.prepare('UPDATE pending_bookings SET paymongo_payment_intent_id = ? WHERE id = ?').run(session.paymentIntentId, pending.id);
        pending.paymongo_payment_intent_id = session.paymentIntentId;
      }
      const booking = await finalizePendingBooking(pending, req);
      return res.json({ status: 'succeeded', booking });
    }
    // Not paid yet — PayMongo's hosted page lets the customer retry a declined/expired
    // attempt in place rather than bouncing them back to us, so there's no reliable "failed"
    // signal to poll for here. The frontend's own poll cap handles abandonment gracefully.
    return res.json({ status: 'processing' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my', authenticate, async (req, res) => {
  const bookings = await db.prepare(`
    SELECT b.*, s.name as service_name, s.category as service_category, s.image as service_image,
    e.first_name as employee_first_name, e.last_name as employee_last_name
    FROM bookings b JOIN services s ON b.service_id = s.id
    LEFT JOIN users e ON b.employee_id = e.id
    WHERE b.user_id = ? ORDER BY b.scheduled_date DESC
  `).all(req.user.id);
  res.json(bookings);
});

// Only cancellable while still 'pending' — once a technician has been assigned and the
// booking is 'confirmed' (or further along), self-service cancellation stops.
router.put('/:id/cancel', authenticate, async (req, res) => {
  const booking = await db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status === 'cancelled') return res.status(400).json({ error: 'This booking has already been cancelled' });
  if (booking.status !== 'pending') return res.status(400).json({ error: 'This booking is already confirmed and can no longer be cancelled' });

  const reason = (req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'A cancellation reason is required' });

  await db.prepare('UPDATE bookings SET status = ?, cancel_reason = ? WHERE id = ?').run('cancelled', reason, booking.id);

  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  await logActivity(req, 'booking.cancel', 'booking', booking.id, {
    customerName: `${user.first_name} ${user.last_name}`,
    reason,
  });

  res.json({ message: 'Booking cancelled' });
});

export default router;
