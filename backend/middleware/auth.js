import jwt from 'jsonwebtoken';
import db from '../db/database.js';

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'homelink-super-secret-key-change-in-production');
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  // Tokens stay valid for 7 days, so staff tokens are re-checked against the account on every
  // request — archiving or deleting an admin/employee cuts off a session they already have
  // open, instead of leaving them their access until the token expires. Customers skip it.
  if (req.user.role !== 'customer') {
    const account = await db.prepare('SELECT archived FROM users WHERE id = ?').get(req.user.id);
    if (!account || account.archived) {
      return res.status(401).json({ error: 'This account is no longer active. Contact an administrator.' });
    }
  }
  next();
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
}

// Lets an admin through unconditionally, or an employee whose position is in
// the given list — used to scope a slice of the admin API to the one
// position that actually does that job (e.g. only inventory clerks touch
// product/service writes) without granting the rest of the admin surface.
export function authorizeAdminOr(...positions) {
  return (req, res, next) => {
    const { role, position } = req.user;
    if (role === 'admin' || (role === 'employee' && positions.includes(position))) {
      return next();
    }
    return res.status(403).json({ error: 'Access denied' });
  };
}
