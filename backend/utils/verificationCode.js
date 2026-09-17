import crypto from 'crypto';

// Shared by password-reset codes (emailed, or generated when an admin approves a staff
// reset request), signup email verification, and 2FA login codes.
const VERIFICATION_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excludes ambiguous 0/O/1/I

export function generateVerificationCode() {
  let code = '';
  for (let i = 0; i < 8; i++) code += VERIFICATION_CODE_CHARS[crypto.randomInt(VERIFICATION_CODE_CHARS.length)];
  return code;
}

export function hashVerificationCode(code) {
  return crypto.createHash('sha256').update(String(code).toUpperCase().trim()).digest('hex');
}

// An approved staff reset code has to be handed over by the admin (in person, by chat), so it
// lives far longer than the 15-minute emailed code — but still expires, and works only once.
export const STAFF_RESET_CODE_TTL_MS = 24 * 60 * 60 * 1000;
