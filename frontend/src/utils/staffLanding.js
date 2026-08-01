// Positions with a scoped slice of the admin panel land straight on the page
// for their task instead of the generic employee dashboard. Positions not
// listed here (installer, customer_support) fall through to /employee.
export const POSITION_LANDING = {
  inventory_clerk: '/admin/products',
  general_staff: '/admin/orders',
  booking_coordinator: '/admin/bookings',
};

export function landingFor(user) {
  if (!user) return null;
  if (user.role === 'admin') return '/admin';
  if (user.role === 'employee') return POSITION_LANDING[user.position] || '/employee';
  return null;
}
