import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { sendEmail, passwordResetEmail } from '../utils/email.js';
import { validatePasswordStrength } from '../utils/password.js';
import { logActivity } from '../utils/audit.js';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const RESET_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excludes ambiguous 0/O/1/I
function generateResetCode() {
  let code = '';
  for (let i = 0; i < 8; i++) code += RESET_CODE_CHARS[crypto.randomInt(RESET_CODE_CHARS.length)];
  return code;
}
function hashResetCode(code) {
  return crypto.createHash('sha256').update(String(code).toUpperCase().trim()).digest('hex');
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, address, acceptedTerms } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    if (!acceptedTerms) {
      return res.status(400).json({ error: 'You must accept the Terms & Conditions to register' });
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const id = uuid();
    const hash = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, verified, terms_accepted_at) VALUES (?,?,?,?,?,?,?,1,?)')
      .run(id, email.toLowerCase(), hash, firstName, lastName, phone || '', address || '', new Date().toISOString());

    await sendEmail({
      to: email,
      subject: 'Welcome to HomeLink!',
      html: `<div style="font-family:Arial"><h2>Welcome to HomeLink, ${firstName}!</h2><p>Your account has been created. Start shopping for home improvement products and book professional services today.</p></div>`,
    });

    const token = jwt.sign({ id, email, role: 'customer' }, process.env.JWT_SECRET || 'homelink-super-secret-key-change-in-production', { expiresIn: '7d' });
    const created = db.prepare('SELECT created_at FROM users WHERE id = ?').get(id);
    res.status(201).json({
      token,
      user: { id, email, firstName, lastName, role: 'customer', createdAt: created.created_at, notifyOrders: true, notifyBookings: true, notifyPromotions: true },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.archived) {
      return res.status(401).json({ error: 'This account has been archived. Contact an administrator.' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'homelink-super-secret-key-change-in-production', { expiresIn: '7d' });

    if (user.role !== 'customer') {
      logActivity({ user: { id: user.id }, ip: req.ip }, 'auth.login', 'user', user.id, { role: user.role });
    }

    res.json({
      token,
      user: {
        id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, phone: user.phone, address: user.address, role: user.role, createdAt: user.created_at,
        notifyOrders: !!user.notify_orders, notifyBookings: !!user.notify_bookings, notifyPromotions: !!user.notify_promotions,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing Google credential' });
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google sign-in is not configured' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email) return res.status(400).json({ error: 'Google account has no verified email' });

    const email = payload.email.toLowerCase();
    let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(payload.sub, email);

    if (!user) {
      const id = uuid();
      const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      db.prepare('INSERT INTO users (id, email, password, first_name, last_name, google_id, verified, terms_accepted_at) VALUES (?,?,?,?,?,?,1,?)')
        .run(id, email, randomPassword, payload.given_name || 'HomeLink', payload.family_name || 'User', payload.sub, new Date().toISOString());
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      await sendEmail({
        to: email,
        subject: 'Welcome to HomeLink!',
        html: `<div style="font-family:Arial"><h2>Welcome to HomeLink, ${user.first_name}!</h2><p>Your account was created using your Google sign-in. Start shopping for home improvement products and book professional services today.</p></div>`,
      });
    } else if (!user.google_id) {
      db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(payload.sub, user.id);
    }

    if (user.role !== 'customer') {
      return res.status(403).json({ error: 'Google sign-in is only available for customer accounts' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'homelink-super-secret-key-change-in-production', { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, phone: user.phone, address: user.address, role: user.role, createdAt: user.created_at,
        notifyOrders: !!user.notify_orders, notifyBookings: !!user.notify_bookings, notifyPromotions: !!user.notify_promotions,
      },
    });
  } catch (err) {
    res.status(401).json({ error: 'Google sign-in failed' });
  }
});

router.post('/apple', async (req, res) => {
  try {
    const { identityToken, firstName, lastName } = req.body;
    if (!identityToken) return res.status(400).json({ error: 'Missing Apple identity token' });
    if (!process.env.APPLE_CLIENT_ID) return res.status(503).json({ error: 'Apple sign-in is not configured' });

    const payload = await appleSignin.verifyIdToken(identityToken, { audience: process.env.APPLE_CLIENT_ID });
    if (!payload?.sub) return res.status(400).json({ error: 'Apple account has no verified identity' });

    const email = (payload.email || '').toLowerCase();
    let user = db.prepare('SELECT * FROM users WHERE apple_id = ? OR (email = ? AND email != \'\')').get(payload.sub, email);

    if (!user) {
      const id = uuid();
      const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      const fallbackEmail = email || `${payload.sub}@appleid.homelink`;
      db.prepare('INSERT INTO users (id, email, password, first_name, last_name, apple_id, verified, terms_accepted_at) VALUES (?,?,?,?,?,?,1,?)')
        .run(id, fallbackEmail, randomPassword, firstName || 'HomeLink', lastName || 'User', payload.sub, new Date().toISOString());
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (email) {
        await sendEmail({
          to: email,
          subject: 'Welcome to HomeLink!',
          html: `<div style="font-family:Arial"><h2>Welcome to HomeLink, ${user.first_name}!</h2><p>Your account was created using Sign in with Apple. Start shopping for home improvement products and book professional services today.</p></div>`,
        });
      }
    } else if (!user.apple_id) {
      db.prepare('UPDATE users SET apple_id = ? WHERE id = ?').run(payload.sub, user.id);
    }

    if (user.role !== 'customer') {
      return res.status(403).json({ error: 'Apple sign-in is only available for customer accounts' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'homelink-super-secret-key-change-in-production', { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, phone: user.phone, address: user.address, role: user.role, createdAt: user.created_at,
        notifyOrders: !!user.notify_orders, notifyBookings: !!user.notify_bookings, notifyPromotions: !!user.notify_promotions,
      },
    });
  } catch (err) {
    res.status(401).json({ error: 'Apple sign-in failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    // Always respond the same way whether or not the account exists, so this endpoint can't be used to enumerate registered emails.
    if (user) {
      const code = generateResetCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(hashResetCode(code), expires, user.id);
      await passwordResetEmail(user, code);
    }

    res.json({ message: 'If an account exists for that email, a verification code has been sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

    const user = db.prepare('SELECT id FROM users WHERE email = ? AND reset_token = ? AND reset_token_expires > ?')
      .get(email.toLowerCase(), hashResetCode(code), new Date().toISOString());
    if (!user) return res.status(400).json({ error: 'This code is invalid or has expired' });

    res.json({ message: 'Code verified' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, password } = req.body;
    if (!email || !code || !password) return res.status(400).json({ error: 'Email, code, and new password are required' });

    const passwordError = validatePasswordStrength(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND reset_token = ? AND reset_token_expires > ?')
      .get(email.toLowerCase(), hashResetCode(code), new Date().toISOString());
    if (!user) return res.status(400).json({ error: 'This code is invalid or has expired' });

    const hash = await bcrypt.hash(password, 10);
    db.prepare('UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?').run(hash, user.id);
    res.json({ message: 'Password has been reset. You can now sign in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, phone: user.phone, address: user.address, role: user.role, createdAt: user.created_at,
    notifyOrders: !!user.notify_orders, notifyBookings: !!user.notify_bookings, notifyPromotions: !!user.notify_promotions,
  });
});

router.put('/profile', authenticate, (req, res) => {
  const { firstName, lastName, phone, address } = req.body;
  db.prepare('UPDATE users SET first_name=?, last_name=?, phone=?, address=? WHERE id=?')
    .run(firstName, lastName, phone || '', address || '', req.user.id);
  res.json({ message: 'Profile updated' });
});

router.put('/notifications', authenticate, (req, res) => {
  const { notifyOrders, notifyBookings, notifyPromotions } = req.body;
  db.prepare('UPDATE users SET notify_orders=?, notify_bookings=?, notify_promotions=? WHERE id=?')
    .run(notifyOrders ? 1 : 0, notifyBookings ? 1 : 0, notifyPromotions ? 1 : 0, req.user.id);
  res.json({ message: 'Notification preferences updated' });
});

router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required' });
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
