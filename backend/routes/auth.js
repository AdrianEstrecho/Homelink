import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { sendEmail, passwordResetEmail, signupVerificationEmail, twoFactorCodeEmail, twoFactorSetupEmail } from '../utils/email.js';
import { validatePasswordStrength } from '../utils/password.js';
import { logActivity } from '../utils/audit.js';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'homelink-super-secret-key-change-in-production';

// Shared by password-reset codes, signup email verification, and 2FA login codes.
const VERIFICATION_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excludes ambiguous 0/O/1/I
function generateVerificationCode() {
  let code = '';
  for (let i = 0; i < 8; i++) code += VERIFICATION_CODE_CHARS[crypto.randomInt(VERIFICATION_CODE_CHARS.length)];
  return code;
}
function hashVerificationCode(code) {
  return crypto.createHash('sha256').update(String(code).toUpperCase().trim()).digest('hex');
}

function signAuthToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, position: user.position }, JWT_SECRET, { expiresIn: '7d' });
}
function toUserResponse(user) {
  return {
    id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, phone: user.phone, address: user.address, role: user.role, position: user.position, createdAt: user.created_at,
    notifyOrders: !!user.notify_orders, notifyBookings: !!user.notify_bookings, notifyPromotions: !!user.notify_promotions, twoFactorEnabled: !!user.two_factor_enabled,
  };
}

router.post('/send-verification-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const normalized = email.toLowerCase().trim();

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalized);
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const code = generateVerificationCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await db.prepare(`
      INSERT INTO signup_verifications (email, code_hash, expires_at) VALUES (?,?,?)
      ON CONFLICT (email) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at
    `).run(normalized, hashVerificationCode(code), expires);

    signupVerificationEmail(normalized, code).catch((emailErr) => console.error(`Failed to send verification email to ${normalized}:`, emailErr.message));

    res.json({ message: 'Verification code sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, address, acceptedTerms, code } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    if (!acceptedTerms) {
      return res.status(400).json({ error: 'You must accept the Terms & Conditions to register' });
    }
    if (!code) return res.status(400).json({ error: 'Please verify your email first' });
    const passwordError = validatePasswordStrength(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const normalized = email.toLowerCase();
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalized);
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const verification = await db.prepare('SELECT email FROM signup_verifications WHERE email = ? AND code_hash = ? AND expires_at > ?')
      .get(normalized, hashVerificationCode(code), new Date().toISOString());
    if (!verification) return res.status(400).json({ error: 'This verification code is invalid or has expired' });

    const id = uuid();
    const hash = await bcrypt.hash(password, 10);
    await db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, verified, terms_accepted_at) VALUES (?,?,?,?,?,?,?,1,?)')
      .run(id, normalized, hash, firstName, lastName, phone || '', address || '', new Date().toISOString());
    await db.prepare('DELETE FROM signup_verifications WHERE email = ?').run(normalized);

    sendEmail({
      to: email,
      subject: 'Welcome to HomeLink!',
      html: `<div style="font-family:Arial"><h2>Welcome to HomeLink, ${firstName}!</h2><p>Your account has been created. Start shopping for home improvement products and book professional services today.</p></div>`,
    }).catch((emailErr) => console.error(`Failed to send welcome email to ${email}:`, emailErr.message));

    const token = signAuthToken({ id, email: normalized, role: 'customer', position: null });
    const created = await db.prepare('SELECT created_at FROM users WHERE id = ?').get(id);
    res.status(201).json({
      token,
      user: { id, email: normalized, firstName, lastName, role: 'customer', createdAt: created.created_at, notifyOrders: true, notifyBookings: true, notifyPromotions: true, twoFactorEnabled: false },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.archived) {
      return res.status(401).json({ error: 'This account has been archived. Contact an administrator.' });
    }

    if (user.two_factor_enabled) {
      const code = generateVerificationCode();
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await db.prepare('UPDATE users SET two_factor_code = ?, two_factor_code_expires = ? WHERE id = ?')
        .run(hashVerificationCode(code), expires, user.id);
      twoFactorCodeEmail(user, code).catch((emailErr) => console.error(`Failed to send 2FA code to ${user.email}:`, emailErr.message));
      return res.json({ requires2FA: true, email: user.email });
    }

    if (user.role !== 'customer') {
      await logActivity({ user: { id: user.id }, ip: req.ip }, 'auth.login', 'user', user.id, { role: user.role });
    }

    res.json({ token: signAuthToken(user), user: toUserResponse(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify-2fa', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

    const user = await db.prepare('SELECT * FROM users WHERE email = ? AND two_factor_code = ? AND two_factor_code_expires > ?')
      .get(email.toLowerCase(), hashVerificationCode(code), new Date().toISOString());
    if (!user) return res.status(400).json({ error: 'This code is invalid or has expired' });
    if (user.archived) {
      return res.status(401).json({ error: 'This account has been archived. Contact an administrator.' });
    }

    await db.prepare('UPDATE users SET two_factor_code = NULL, two_factor_code_expires = NULL WHERE id = ?').run(user.id);

    if (user.role !== 'customer') {
      await logActivity({ user: { id: user.id }, ip: req.ip }, 'auth.login', 'user', user.id, { role: user.role });
    }

    res.json({ token: signAuthToken(user), user: toUserResponse(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/google', async (req, res) => {
  try {
    const { credential, mode } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing Google credential' });
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google sign-in is not configured' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email) return res.status(400).json({ error: 'Google account has no verified email' });

    const email = payload.email.toLowerCase();
    let user = await db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(payload.sub, email);

    if (!user && mode === 'login') {
      return res.status(404).json({ error: 'No HomeLink account is registered with this Google account. Please register first.', code: 'not_registered' });
    }

    if (!user) {
      const id = uuid();
      const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      await db.prepare('INSERT INTO users (id, email, password, first_name, last_name, google_id, verified, terms_accepted_at) VALUES (?,?,?,?,?,?,1,?)')
        .run(id, email, randomPassword, payload.given_name || 'HomeLink', payload.family_name || 'User', payload.sub, new Date().toISOString());
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      sendEmail({
        to: email,
        subject: 'Welcome to HomeLink!',
        html: `<div style="font-family:Arial"><h2>Welcome to HomeLink, ${user.first_name}!</h2><p>Your account was created using your Google sign-in. Start shopping for home improvement products and book professional services today.</p></div>`,
      }).catch((emailErr) => console.error(`Failed to send welcome email to ${email}:`, emailErr.message));
    } else if (!user.google_id) {
      await db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(payload.sub, user.id);
    }

    if (user.role !== 'customer') {
      return res.status(403).json({ error: 'Google sign-in is only available for customer accounts' });
    }

    // Google already verifies the email, but that's a first factor, not a second one — an
    // account with 2FA on still needs the emailed code, same as password login.
    if (user.two_factor_enabled) {
      const code = generateVerificationCode();
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await db.prepare('UPDATE users SET two_factor_code = ?, two_factor_code_expires = ? WHERE id = ?')
        .run(hashVerificationCode(code), expires, user.id);
      twoFactorCodeEmail(user, code).catch((emailErr) => console.error(`Failed to send 2FA code to ${user.email}:`, emailErr.message));
      return res.json({ requires2FA: true, email: user.email });
    }

    res.json({ token: signAuthToken(user), user: toUserResponse(user) });
  } catch (err) {
    res.status(401).json({ error: 'Google sign-in failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    // Always respond the same way whether or not the account exists, so this endpoint can't be used to enumerate registered emails.
    if (user) {
      const code = generateVerificationCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(hashVerificationCode(code), expires, user.id);
      passwordResetEmail(user, code).catch((emailErr) => console.error(`Failed to send password reset email to ${user.email}:`, emailErr.message));
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

    const user = await db.prepare('SELECT id FROM users WHERE email = ? AND reset_token = ? AND reset_token_expires > ?')
      .get(email.toLowerCase(), hashVerificationCode(code), new Date().toISOString());
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

    const user = await db.prepare('SELECT * FROM users WHERE email = ? AND reset_token = ? AND reset_token_expires > ?')
      .get(email.toLowerCase(), hashVerificationCode(code), new Date().toISOString());
    if (!user) return res.status(400).json({ error: 'This code is invalid or has expired' });

    const hash = await bcrypt.hash(password, 10);
    await db.prepare('UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?').run(hash, user.id);
    res.json({ message: 'Password has been reset. You can now sign in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(toUserResponse(user));
});

// Emails a one-time code to the signed-in user, used to confirm they actually own the
// inbox before two_factor_enabled gets flipped on (see PUT /two-factor below).
router.post('/two-factor/send-code', authenticate, async (req, res) => {
  try {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const code = generateVerificationCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await db.prepare('UPDATE users SET two_factor_code = ?, two_factor_code_expires = ? WHERE id = ?')
      .run(hashVerificationCode(code), expires, user.id);
    twoFactorSetupEmail(user, code).catch((emailErr) => console.error(`Failed to send 2FA setup code to ${user.email}:`, emailErr.message));

    res.json({ message: 'Verification code sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/two-factor', authenticate, async (req, res) => {
  try {
    const { enabled, code } = req.body;

    // Disabling doesn't need re-verification — turning it off just removes a protection,
    // it doesn't grant one, so there's nothing here for a stolen code to bypass.
    if (!enabled) {
      await db.prepare('UPDATE users SET two_factor_enabled = 0, two_factor_code = NULL, two_factor_code_expires = NULL WHERE id = ?').run(req.user.id);
      return res.json({ message: 'Two-factor authentication disabled', twoFactorEnabled: false });
    }

    if (!code) return res.status(400).json({ error: 'Enter the verification code sent to your email first' });
    const user = await db.prepare('SELECT id FROM users WHERE id = ? AND two_factor_code = ? AND two_factor_code_expires > ?')
      .get(req.user.id, hashVerificationCode(code), new Date().toISOString());
    if (!user) return res.status(400).json({ error: 'This code is invalid or has expired' });

    await db.prepare('UPDATE users SET two_factor_enabled = 1, two_factor_code = NULL, two_factor_code_expires = NULL WHERE id = ?').run(req.user.id);
    res.json({ message: 'Two-factor authentication enabled', twoFactorEnabled: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile', authenticate, async (req, res) => {
  const { firstName, lastName, phone, address } = req.body;
  await db.prepare('UPDATE users SET first_name=?, last_name=?, phone=?, address=? WHERE id=?')
    .run(firstName, lastName, phone || '', address || '', req.user.id);
  res.json({ message: 'Profile updated' });
});

router.put('/notifications', authenticate, async (req, res) => {
  const { notifyOrders, notifyBookings, notifyPromotions } = req.body;
  await db.prepare('UPDATE users SET notify_orders=?, notify_bookings=?, notify_promotions=? WHERE id=?')
    .run(notifyOrders ? 1 : 0, notifyBookings ? 1 : 0, notifyPromotions ? 1 : 0, req.user.id);
  res.json({ message: 'Notification preferences updated' });
});

router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required' });
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
