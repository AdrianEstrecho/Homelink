export const passwordRules = [
  { key: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { key: 'lower', label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { key: 'upper', label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { key: 'number', label: 'One number', test: (pw) => /[0-9]/.test(pw) },
];

export function isPasswordValid(password) {
  return passwordRules.every(rule => rule.test(password || ''));
}
