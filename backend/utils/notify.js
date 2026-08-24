import { v4 as uuid } from 'uuid';
import db from '../db/database.js';

// Records a personal notification for one recipient (a job assignment, a new
// message) — separate from logActivity, which records the actor's action for
// the admin audit trail rather than who should be told about it.
export async function notifyUser(userId, type, title, message, link) {
  await db.prepare('INSERT INTO notifications (id, user_id, type, title, message, link) VALUES (?,?,?,?,?,?)')
    .run(uuid(), userId, type, title, message, link || null);
}
