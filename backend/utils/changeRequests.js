import { v4 as uuid } from 'uuid';
import db from '../db/database.js';

// Creates a pending change request instead of applying a write directly — used for writes
// from positions whose changes need a reviewer to sign off before they take effect (general
// staff's product/service/voucher writes, HR/accounting's requests, installers' job
// completions). See admin.js's "Change requests" section for how these get approved/rejected.
export function createChangeRequest(entityType, action, entityId, payload, requestedBy) {
  const id = uuid();
  db.prepare('INSERT INTO change_requests (id, entity_type, entity_id, action, payload, requested_by) VALUES (?,?,?,?,?,?)')
    .run(id, entityType, entityId, action, payload ? JSON.stringify(payload) : null, requestedBy);
  return id;
}
