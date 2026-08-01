export function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must include a number';
  return null;
}
