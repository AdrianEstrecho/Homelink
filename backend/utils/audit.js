import { v4 as uuid } from 'uuid';
import db from '../db/database.js';

// Records a staff action (login, booking/order updates, user management, etc.)
// so admins can review an audit trail of what employees and admins have been doing.
export async function logActivity(req, action, entityType, entityId, details) {
  await db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuid(),
    req.user?.id || null,
    action,
    entityType || null,
    entityId || null,
    details !== undefined ? JSON.stringify(details) : null,
    req.ip || null
  );
}
