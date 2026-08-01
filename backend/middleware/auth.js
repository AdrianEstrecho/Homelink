import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'homelink-super-secret-key-change-in-production');
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
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
