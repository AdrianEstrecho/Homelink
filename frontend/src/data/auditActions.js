import { formatTicketNo } from '../utils/ticketNumber';

export const POSITION_LABELS = {
  inventory_clerk: 'Inventory Clerk',
  booking_coordinator: 'Booking Coordinator',
  installer: 'Installer / Technician',
  hr: 'Human Resources',
  general_staff: 'General Staff',
};

// The same employee `position` values, named as the department each one belongs to — the
// stored value still drives access scoping, this is only how HR-facing screens label it.
export const DEPARTMENT_LABELS = {
  booking_coordinator: 'Bookings',
  hr: 'Human Resources',
  installer: 'Installation',
  inventory_clerk: 'Inventory',
  general_staff: 'Operations',
};

export const ROLE_LABELS = { admin: 'Administrator', employee: 'Employee' };

// The screen each logged action is taken from, shown in the Audit Trail's "Page" column.
// Only staff pages an admin can open carry a `to`; customer-side and sign-in screens are
// named but not linked.
export const PAGES = {
  staffLogin: { label: 'Staff Login' },
  staffForgotPassword: { label: 'Staff Forgot Password' },
  approvals: { label: 'Approvals', to: '/admin/approvals' },
  products: { label: 'Products', to: '/admin/products' },
  services: { label: 'Services', to: '/admin/services' },
  orders: { label: 'Orders', to: '/admin/orders' },
  returns: { label: 'Returns & Cancellations', to: '/admin/returns' },
  bookings: { label: 'Bookings', to: '/admin/bookings' },
  users: { label: 'Users', to: '/admin/users' },
  employees: { label: 'Employees', to: '/admin/hr/employees' },
  admins: { label: 'Admin Management', to: '/admin/staff' },
  technicians: { label: 'Technicians', to: '/admin/technicians' },
  vouchers: { label: 'Vouchers', to: '/admin/vouchers' },
  support: { label: 'Support', to: '/admin/support' },
  suppliers: { label: 'Suppliers', to: '/admin/suppliers' },
  cms: { label: 'Content (CMS)', to: '/admin/cms' },
  myJobs: { label: 'My Jobs (Installer)' },
  checkout: { label: 'Checkout (Customer)' },
  serviceBooking: { label: 'Book a Service (Customer)' },
  myOrders: { label: 'My Orders (Customer)' },
  myBookings: { label: 'My Bookings (Customer)' },
  myAccount: { label: 'My Account (Customer)' },
};

// User Management is one panel mounted on three pages, one per role of the account acted on.
const userPage = d => ({ customer: 'users', admin: 'admins' }[d.role] || 'employees');
// Booking coordinators add installers from their Technicians page rather than Employees.
const userCreatePage = (d, log) => (d.position === 'installer' && log.user_position === 'booking_coordinator' ? 'technicians' : userPage(d));
// Installers (and employees with no position) move their own jobs along from /employee;
// everyone else changes a booking's status from the Bookings page.
const bookingStatusPage = (d, log) => (log.user_role === 'employee' && (!log.user_position || log.user_position === 'installer') ? 'myJobs' : 'bookings');
const restockPage = d => ({ return: 'returns', approval: 'approvals' }[d.source] || 'products');

export const ACTION_META = {
  'auth.login': { category: 'login', page: 'staffLogin', describe: () => 'Logged in' },
  'auth.password_reset_request': { category: 'update', page: 'staffForgotPassword', describe: d => `${d.name || d.email} forgot their password and is waiting for approval` },
  'auth.password_reset_approve': { category: 'update', page: 'approvals', describe: d => `Approved a password reset for ${d.name || d.email} and issued a reset code` },
  'auth.password_reset': { category: 'update', page: 'staffForgotPassword', describe: d => `Changed their password using a reset code (${d.email})` },
  'user.create': { category: 'create', page: userCreatePage, describe: d => `Created user ${d.email}${d.role ? ` (${ROLE_LABELS[d.role] || d.role}${d.position ? `, ${POSITION_LABELS[d.position] || d.position}` : ''})` : ''}` },
  'user.promote': { category: 'update', page: 'employees', describe: d => `Promoted ${d.email} to ${POSITION_LABELS[d.toPosition] || d.toPosition}` },
  'user.delete': { category: 'delete', page: userPage, describe: d => `Deleted user ${d.email}` },
  'user.archive': { category: 'archive', page: userPage, describe: d => `Archived user ${d.email}` },
  'user.restore': { category: 'archive', page: userPage, describe: d => `Restored user ${d.email}` },
  'booking.create': { category: 'create', page: 'serviceBooking', describe: d => `${d.customerName || 'A customer'} booked ${d.serviceName || 'a service'}${d.scheduledDate ? ` for ${d.scheduledDate}` : ''}` },
  'booking.status_update': { category: 'update', page: bookingStatusPage, describe: d => `Status changed: ${d.from || '—'} → ${d.to}${d.completionNotes ? ` · "${d.completionNotes}"` : ''}` },
  'booking.completed': { category: 'update', page: 'approvals', describe: d => `${d.serviceName || 'Service'} for ${d.customerName || 'a customer'} marked Installed Completed by ${d.installerName || 'installer'}${d.completionNotes ? ` · "${d.completionNotes}"` : ''}` },
  'booking.assign': { category: 'update', page: 'bookings', describe: (d, nameOf) => `Assigned to ${nameOf?.(d.toEmployeeId) || '—'}` },
  'booking.unassign': { category: 'update', page: 'bookings', describe: (d, nameOf) => `Unassigned from ${nameOf?.(d.fromEmployeeId) || '—'}` },
  'booking.cancel': { category: 'update', page: 'myBookings', describe: d => `${d.customerName || 'A customer'} cancelled their booking${d.reason ? ` — "${d.reason}"` : ''}` },
  'booking.needs_review': { category: 'update', page: 'serviceBooking', describe: d => `Flagged ${d.customerName ? `${d.customerName}'s` : 'a'} paid booking for review — ${d.reason}` },
  'order.create': { category: 'create', page: 'checkout', describe: d => `${d.customerName || 'A customer'} placed an order for ${d.itemCount || ''} item${d.itemCount === 1 ? '' : 's'} (₱${Number(d.total || 0).toLocaleString('en-PH')})` },
  'order.status_update': { category: 'update', page: 'orders', describe: d => `Status changed: ${d.from || '—'} → ${d.to}` },
  'order.cancel': { category: 'update', page: 'myOrders', describe: d => `${d.customerName || 'A customer'} cancelled their order${d.reason ? ` — "${d.reason}"` : ''}` },
  'order.complete': { category: 'create', page: 'myOrders', describe: d => `${d.customerName || 'A customer'} confirmed order #${d.orderRef} as completed — returns closed` },
  'order.needs_review': { category: 'update', page: 'checkout', describe: d => `Flagged ${d.customerName ? `${d.customerName}'s` : 'a'} paid order for review — ${d.reason}` },
  'order.stock_returned': { category: 'update', page: 'orders', describe: d => `Returned ${d.units || 0} unit${d.units === 1 ? '' : 's'} to stock after the order was cancelled` },
  'order.stock_reserved': { category: 'update', page: 'orders', describe: d => `Took ${d.units || 0} unit${d.units === 1 ? '' : 's'} back out of stock after the cancelled order was reinstated` },
  // Older entries, from before paid orders carried their own needs_review flag.
  'order.oversold_after_payment': { category: 'update', page: 'checkout', describe: () => 'An item sold out while the customer was paying — needs review' },
  // d.kind is 'cancellation' for a refund raised by a customer cancelling an order they had
  // already paid for. Entries written before that existed carry no kind and read as returns,
  // which is what they were.
  'return.create': { category: 'create', page: 'myOrders', describe: d => (d.kind === 'cancellation'
    ? `${d.customerName || 'A customer'} cancelled paid order #${d.orderRef} — refund of ${d.refundAmount != null ? `₱${Number(d.refundAmount).toLocaleString('en-PH')}` : 'the order total'} awaiting approval${d.reason ? ` ("${d.reason}")` : ''}`
    : `${d.customerName || 'A customer'} requested a return on order #${d.orderRef} — ${d.itemCount} item${d.itemCount === 1 ? '' : 's'}${d.reason ? ` ("${d.reason}")` : ''}`) },
  'return.approve': { category: 'update', page: 'returns', describe: d => (d.kind === 'cancellation'
    ? `Approved refund ${d.returnRef} for ${d.customerName || 'a customer'} on cancelled order #${d.orderRef} — awaiting payout`
    : `Approved ${d.returnRef} for ${d.customerName || 'a customer'} on order #${d.orderRef} — awaiting the items`) },
  'return.reject': { category: 'update', page: 'returns', describe: d => (d.kind === 'cancellation'
    ? `Declined refund ${d.returnRef} for ${d.customerName || 'a customer'}${d.note ? ` — "${d.note}"` : ''}`
    : `Rejected ${d.returnRef} for ${d.customerName || 'a customer'}${d.note ? ` — "${d.note}"` : ''}`) },
  'return.received': { category: 'update', page: 'returns', describe: d => `Received ${d.itemCount} unit${d.itemCount === 1 ? '' : 's'} back for ${d.returnRef} and added them to stock${d.paymentStatusTo === 'refunded' ? ' — order marked refunded' : ''}` },
  'return.refund_mark': { category: 'update', page: 'returns', describe: d => `Marked ${d.returnRef} as ${d.to === 'refunded' ? 'refunded' : d.to.replace('_', ' ')} (was ${String(d.from || '').replace('_', ' ')})${d.paymentStatusTo === 'refunded' ? ' — order marked refunded' : ''}` },
  'support.create': { category: 'create', page: 'myAccount', describe: d => `${d.customerName || 'A customer'} sent a ${d.type || 'support'} message${d.ticketNumber ? ` (${formatTicketNo(d.ticketNumber)})` : ''}: "${d.subject}"` },
  'support.reply': { category: 'update', page: 'support', describe: d => `Replied to ${d.ticketNumber ? formatTicketNo(d.ticketNumber) : `"${d.subject}"`}${d.preview ? `: "${d.preview}"` : ''}` },
  'support.request_resolve': { category: 'update', page: 'support', describe: d => `Requested resolution approval for ${d.ticketNumber ? formatTicketNo(d.ticketNumber) : `"${d.subject}"`}` },
  'support.resolve': { category: 'update', page: 'approvals', describe: d => `Marked resolved: ${d.ticketNumber ? formatTicketNo(d.ticketNumber) : ''} "${d.subject}"` },
  'support.reopen': { category: 'update', page: 'support', describe: d => `Reopened: ${d.ticketNumber ? formatTicketNo(d.ticketNumber) : ''} "${d.subject}"` },
  'product.create': { category: 'create', page: 'products', describe: d => `Created product "${d.name}"` },
  'product.update': { category: 'update', page: 'products', describe: d => `Updated product "${d.name}"` },
  'product.restock': { category: 'update', page: restockPage, describe: d => `Added ${d.quantity} units to "${d.name}" (${d.from} → ${d.to}) — verified by ${d.clerkName} (${d.clerkCode})` },
  'product.archive': { category: 'archive', page: 'products', describe: d => `Archived product "${d.name}"` },
  'product.restore': { category: 'archive', page: 'products', describe: d => `Restored product "${d.name}"` },
  'product.delete': { category: 'delete', page: 'products', describe: d => `Deleted product "${d.name}"` },
  'category.create': { category: 'create', page: 'products', describe: d => `Created category "${d.name}"` },
  'category.update': { category: 'update', page: 'products', describe: d => `Updated category "${d.name}"` },
  'category.delete': { category: 'delete', page: 'products', describe: d => `Deleted category "${d.name}"` },
  'service.create': { category: 'create', page: 'services', describe: d => `Created service "${d.name}"` },
  'service.update': { category: 'update', page: 'services', describe: d => `Updated service "${d.name}"` },
  'service.archive': { category: 'archive', page: 'services', describe: d => `Archived service "${d.name}"` },
  'service.restore': { category: 'archive', page: 'services', describe: d => `Restored service "${d.name}"` },
  'service.delete': { category: 'delete', page: 'services', describe: d => `Deleted service "${d.name}"` },
  'voucher.create': { category: 'create', page: 'vouchers', describe: d => `Created voucher ${d.code}` },
  'voucher.activate': { category: 'update', page: 'vouchers', describe: d => `Activated voucher ${d.code}` },
  'voucher.deactivate': { category: 'update', page: 'vouchers', describe: d => `Deactivated voucher ${d.code}` },
  'voucher.delete': { category: 'delete', page: 'vouchers', describe: d => `Deleted voucher ${d.code}` },
  'announcement.create': { category: 'create', page: 'cms', describe: d => `Created announcement "${d.title}"` },
  'announcement.delete': { category: 'delete', page: 'cms', describe: d => `Deleted announcement "${d.title}"` },
  'supplier.create': { category: 'create', page: 'suppliers', describe: d => `Added supplier "${d.name}"` },
  'supplier.update': { category: 'update', page: 'suppliers', describe: d => `Updated supplier "${d.name}"` },
  'supplier.activate': { category: 'update', page: 'suppliers', describe: d => `Activated supplier "${d.name}"` },
  'supplier.deactivate': { category: 'update', page: 'suppliers', describe: d => `Deactivated supplier "${d.name}"` },
  'supplier.delete': { category: 'delete', page: 'suppliers', describe: d => `Deleted supplier "${d.name}"` },
};

export const CATEGORY_STYLE = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-amber-100 text-amber-800',
  delete: 'bg-red-100 text-red-800',
  login: 'bg-blue-100 text-blue-800',
  archive: 'bg-purple-100 text-purple-800',
};

// Anything carrying `authorizedBy` was applied by a reviewer approving a change request, so
// whatever page proposed it, the reviewer acted from Approvals. Actions with no meta entry
// fall back to their raw entity type, unlinked.
export function pageFor(log) {
  const d = log.details || {};
  if (d.authorizedBy) return PAGES.approvals;
  const page = ACTION_META[log.action]?.page;
  const key = typeof page === 'function' ? page(d, log) : page;
  return PAGES[key] || (log.entity_type ? { label: log.entity_type } : null);
}

// The backend used to return SQLite's naive "YYYY-MM-DD HH:MM:SS" (no timezone), so this
// forced UTC by hand. Postgres (via `pg`) now hands back TIMESTAMPTZ columns as real Date
// objects, which serialize over JSON as full ISO strings already carrying a "Z" — blindly
// appending another one turned those into an invalid date that threw on `.toISOString()`.
// Only add the "Z" when the string doesn't already carry timezone info.
export function parseUtc(sqliteUtc) {
  if (!sqliteUtc) return null;
  const isTagged = /[zZ]|[+-]\d{2}:?\d{2}$/.test(sqliteUtc);
  return new Date(isTagged ? sqliteUtc : `${sqliteUtc.replace(' ', 'T')}Z`);
}

export function formatDateTime(sqliteUtc) {
  if (!sqliteUtc) return '—';
  const date = parseUtc(sqliteUtc);
  return date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

export function timeAgo(sqliteUtc) {
  if (!sqliteUtc) return '—';
  const date = parseUtc(sqliteUtc);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDateTime(sqliteUtc);
}
