import { Router } from 'express';
import db from '../db/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logActivity } from '../utils/audit.js';

const router = Router();
router.use(authenticate, authorize('employee'));

router.get('/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const assigned = db.prepare(`
    SELECT b.*, s.name as service_name, s.category, u.first_name, u.last_name, u.phone, u.email
    FROM bookings b JOIN services s ON b.service_id=s.id JOIN users u ON b.user_id=u.id
    WHERE b.employee_id = ? ORDER BY b.scheduled_date, b.scheduled_time
  `).all(req.user.id);
  const todayJobs = assigned.filter(b => b.scheduled_date === today);
  res.json({ assigned, todayJobs, stats: { total: assigned.length, pending: assigned.filter(b => b.status === 'pending' || b.status === 'confirmed').length, completed: assigned.filter(b => b.status === 'completed').length } });
});

router.get('/schedule', (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, s.name as service_name, u.first_name, u.last_name, u.phone, u.address as customer_address
    FROM bookings b JOIN services s ON b.service_id=s.id JOIN users u ON b.user_id=u.id
    WHERE b.employee_id = ? ORDER BY b.scheduled_date DESC
  `).all(req.user.id);
  res.json(bookings);
});

router.put('/bookings/:id/status', (req, res) => {
  const { status, completionNotes } = req.body;
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND employee_id = ?').get(req.params.id, req.user.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found or not assigned to you' });
  db.prepare('UPDATE bookings SET status = ?, completion_notes = ? WHERE id = ?').run(status, completionNotes || '', req.params.id);
  logActivity(req, 'booking.status_update', 'booking', req.params.id, { from: booking.status, to: status, completionNotes: completionNotes || undefined });
  res.json({ message: 'Status updated' });
});

export default router;
