import { Router } from 'express';
import db from '../db/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logActivity } from '../utils/audit.js';
import { notifyUser } from '../utils/notify.js';
import { createChangeRequest } from '../utils/changeRequests.js';

const router = Router();
router.use(authenticate, authorize('employee'));

// The 3-stage flow an installer confirms a job through: Under Review (just
// assigned) -> Ongoing (installer started) -> Installed Completed. Reuses the
// existing booking status column/values rather than adding new ones, so every
// other view (admin Bookings, coordinator dashboard, customer pages) that
// already reads status='confirmed'|'in_progress'|'completed' keeps working.
const INSTALLER_STATUSES = ['confirmed', 'in_progress', 'completed'];

router.get('/dashboard', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const assigned = await db.prepare(`
    SELECT b.*, s.name as service_name, s.category, u.first_name, u.last_name, u.phone, u.email
    FROM bookings b JOIN services s ON b.service_id=s.id JOIN users u ON b.user_id=u.id
    WHERE b.employee_id = ? ORDER BY b.scheduled_date, b.scheduled_time
  `).all(req.user.id);
  const todayJobs = assigned.filter(b => b.scheduled_date === today);
  res.json({ assigned, todayJobs, stats: { total: assigned.length, pending: assigned.filter(b => b.status === 'pending' || b.status === 'confirmed').length, completed: assigned.filter(b => b.status === 'completed').length } });
});

router.get('/schedule', async (req, res) => {
  const bookings = await db.prepare(`
    SELECT b.*, s.name as service_name, u.first_name, u.last_name, u.phone, u.address as customer_address
    FROM bookings b JOIN services s ON b.service_id=s.id JOIN users u ON b.user_id=u.id
    WHERE b.employee_id = ? ORDER BY b.scheduled_date DESC
  `).all(req.user.id);
  res.json(bookings);
});

router.put('/bookings/:id/status', async (req, res) => {
  const { status, completionNotes } = req.body;
  if (!INSTALLER_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  const booking = await db.prepare('SELECT * FROM bookings WHERE id = ? AND employee_id = ?').get(req.params.id, req.user.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found or not assigned to you' });

  // Marking a job Installed Completed is the consequential step — like general staff's
  // product/service writes, it's only *proposed* here: queued as a change request until a
  // booking coordinator verifies it, rather than applied immediately. Starting a job
  // (confirmed -> in_progress) stays immediate since it's low-risk and easily corrected.
  if (status === 'completed') {
    if (booking.status === 'completed') return res.status(400).json({ error: 'This job is already marked completed.' });
    const alreadyPending = await db.prepare("SELECT id FROM change_requests WHERE entity_type='booking' AND entity_id=? AND status='pending'").get(req.params.id);
    if (alreadyPending) return res.status(400).json({ error: 'A completion request for this job is already pending verification.' });

    const requestId = await createChangeRequest('booking', 'update', req.params.id, { status, completionNotes: completionNotes || '' }, req.user.id);

    const jobDetails = await db.prepare(`
      SELECT s.name as service_name, u.first_name, u.last_name
      FROM bookings b JOIN services s ON b.service_id = s.id JOIN users u ON b.user_id = u.id
      WHERE b.id = ?
    `).get(req.params.id);
    const installer = await db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').get(req.user.id);
    const serviceName = jobDetails?.service_name || 'Service';
    const customerName = jobDetails ? `${jobDetails.first_name} ${jobDetails.last_name}` : 'a customer';
    const installerName = installer ? `${installer.first_name} ${installer.last_name}` : 'The installer';
    const message = `${installerName} marked ${serviceName} for ${customerName} as Installed Completed — needs your verification.`;

    const coordinators = await db.prepare("SELECT id FROM users WHERE role='employee' AND position='booking_coordinator'").all();
    for (const c of coordinators) await notifyUser(c.id, 'booking.complete_requested', 'Completion Needs Verification', message, '/admin/approvals');

    return res.status(202).json({ pending: true, requestId, message: 'Submitted for booking coordinator verification.' });
  }

  await db.prepare('UPDATE bookings SET status = ?, completion_notes = ? WHERE id = ?').run(status, completionNotes || '', req.params.id);
  await logActivity(req, 'booking.status_update', 'booking', req.params.id, { from: booking.status, to: status });
  res.json({ message: 'Status updated' });
});

export default router;
