export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailValid(email) {
  return EMAIL_PATTERN.test((email || '').trim());
}
