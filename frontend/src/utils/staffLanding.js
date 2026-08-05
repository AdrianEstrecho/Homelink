// Positions with a scoped slice of the admin panel land on their own dashboard
// (a stats overview of their area) instead of the generic employee dashboard.
// installer isn't listed here — the generic employee dashboard (assigned
// jobs) already is its intended page, so it falls through to /employee.
export const POSITION_LANDING = {
  inventory_clerk: '/admin/products/dashboard',
  general_staff: '/admin/orders/dashboard',
  booking_coordinator: '/admin/bookings/dashboard',
  accounting: '/admin/payroll/dashboard',
  hr: '/admin/hr/dashboard',
};

export function landingFor(user) {
  if (!user) return null;
  if (user.role === 'admin') return '/admin';
  if (user.role === 'employee') return POSITION_LANDING[user.position] || '/employee';
  return null;
}
