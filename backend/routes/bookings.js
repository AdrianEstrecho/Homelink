import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { getFirstTimeServiceDiscount, getHolidayDiscount, calculateDiscount } from '../utils/promos.js';
import { bookingConfirmationEmail } from '../utils/email.js';

const router = Router();

router.get('/availability', (req, res) => {
  const { date } = req.query;
  const slots = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
  const booked = db.prepare('SELECT scheduled_time FROM bookings WHERE scheduled_date = ? AND status NOT IN (\'cancelled\')').all(date || new Date().toISOString().split('T')[0]);
  const bookedTimes = booked.map(b => b.scheduled_time);
  res.json(slots.map(time => ({ time, available: !bookedTimes.includes(time) })));
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { serviceId, scheduledDate, scheduledTime, address, notes, paymentMethod } = req.body;
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    let price = service.base_price;
    let discount = 0;
    const firstTime = getFirstTimeServiceDiscount(req.user.id);
    if (firstTime) discount += calculateDiscount(price, firstTime);
    const holiday = getHolidayDiscount();
    if (holiday) discount += calculateDiscount(price - discount, holiday);
    price = Math.max(0, price - discount);

    const id = uuid();
    db.prepare(`INSERT INTO bookings (id, user_id, service_id, scheduled_date, scheduled_time, address, notes, price, discount, payment_status)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(id, req.user.id, serviceId, scheduledDate, scheduledTime, address, notes || '', price, discount, 'paid');

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    await bookingConfirmationEmail(booking, service, user);

    res.status(201).json({ bookingId: id, price, discount, status: 'pending' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my', authenticate, (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, s.name as service_name, s.category as service_category, s.image as service_image,
    e.first_name as employee_first_name, e.last_name as employee_last_name
    FROM bookings b JOIN services s ON b.service_id = s.id
    LEFT JOIN users e ON b.employee_id = e.id
    WHERE b.user_id = ? ORDER BY b.scheduled_date DESC
  `).all(req.user.id);
  res.json(bookings);
});

router.put('/:id/cancel', authenticate, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status === 'completed') return res.status(400).json({ error: 'Cannot cancel completed booking' });
  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('cancelled', req.params.id);
  res.json({ message: 'Booking cancelled' });
});

export default router;
