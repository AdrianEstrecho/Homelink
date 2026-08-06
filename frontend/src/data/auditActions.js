export const POSITION_LABELS = {
  inventory_clerk: 'Inventory Clerk',
  booking_coordinator: 'Booking Coordinator',
  installer: 'Installer / Technician',
  accounting: 'Accounting',
  hr: 'Human Resources',
  general_staff: 'General Staff',
};

export const ROLE_LABELS = { admin: 'Administrator', employee: 'Employee' };

export const ACTION_META = {
  'auth.login': { category: 'login', entity: 'User', describe: () => 'Logged in' },
  'user.create': { category: 'create', entity: 'User', describe: d => `Created user ${d.email}${d.role ? ` (${ROLE_LABELS[d.role] || d.role}${d.position ? `, ${POSITION_LABELS[d.position] || d.position}` : ''})` : ''}` },
  'user.promote': { category: 'update', entity: 'User', describe: d => `Promoted ${d.email} to ${POSITION_LABELS[d.toPosition] || d.toPosition}` },
  'user.delete': { category: 'delete', entity: 'User', describe: d => `Deleted user ${d.email}` },
  'user.archive': { category: 'archive', entity: 'User', describe: d => `Archived user ${d.email}` },
  'user.restore': { category: 'archive', entity: 'User', describe: d => `Restored user ${d.email}` },
  'booking.create': { category: 'create', entity: 'Booking', describe: d => `${d.customerName || 'A customer'} booked ${d.serviceName || 'a service'}${d.scheduledDate ? ` for ${d.scheduledDate}` : ''}` },
  'booking.status_update': { category: 'update', entity: 'Booking', describe: d => `Status changed: ${d.from || '—'} → ${d.to}${d.completionNotes ? ` · "${d.completionNotes}"` : ''}` },
  'booking.completed': { category: 'update', entity: 'Booking', describe: d => `${d.serviceName || 'Service'} for ${d.customerName || 'a customer'} marked Installed Completed by ${d.installerName || 'installer'}${d.completionNotes ? ` · "${d.completionNotes}"` : ''}` },
  'booking.assign': { category: 'update', entity: 'Booking', describe: (d, nameOf) => `Assigned to ${nameOf?.(d.toEmployeeId) || '—'}` },
  'booking.unassign': { category: 'update', entity: 'Booking', describe: (d, nameOf) => `Unassigned from ${nameOf?.(d.fromEmployeeId) || '—'}` },
  'booking.cancel': { category: 'update', entity: 'Booking', describe: d => `${d.customerName || 'A customer'} cancelled their booking${d.reason ? ` — "${d.reason}"` : ''}` },
  'order.create': { category: 'create', entity: 'Order', describe: d => `${d.customerName || 'A customer'} placed an order for ${d.itemCount || ''} item${d.itemCount === 1 ? '' : 's'} (₱${Number(d.total || 0).toLocaleString('en-PH')})` },
  'order.status_update': { category: 'update', entity: 'Order', describe: d => `Status changed: ${d.from || '—'} → ${d.to}` },
  'order.cancel': { category: 'update', entity: 'Order', describe: d => `${d.customerName || 'A customer'} cancelled their order${d.reason ? ` — "${d.reason}"` : ''}` },
  'support.create': { category: 'create', entity: 'Support', describe: d => `${d.customerName || 'A customer'} sent a ${d.type || 'support'} message: "${d.subject}"` },
  'support.resolve': { category: 'update', entity: 'Support', describe: d => `Marked resolved: "${d.subject}"` },
  'support.reopen': { category: 'update', entity: 'Support', describe: d => `Reopened: "${d.subject}"` },
  'product.create': { category: 'create', entity: 'Product', describe: d => `Created product "${d.name}"` },
  'product.update': { category: 'update', entity: 'Product', describe: d => `Updated product "${d.name}"` },
  'product.restock': { category: 'update', entity: 'Product', describe: d => `Added ${d.quantity} units to "${d.name}" (${d.from} → ${d.to}) — verified by ${d.clerkName} (${d.clerkCode})` },
  'product.archive': { category: 'archive', entity: 'Product', describe: d => `Archived product "${d.name}"` },
  'product.restore': { category: 'archive', entity: 'Product', describe: d => `Restored product "${d.name}"` },
  'product.delete': { category: 'delete', entity: 'Product', describe: d => `Deleted product "${d.name}"` },
  'category.create': { category: 'create', entity: 'Category', describe: d => `Created category "${d.name}"` },
  'category.update': { category: 'update', entity: 'Category', describe: d => `Updated category "${d.name}"` },
  'category.delete': { category: 'delete', entity: 'Category', describe: d => `Deleted category "${d.name}"` },
  'service.create': { category: 'create', entity: 'Service', describe: d => `Created service "${d.name}"` },
  'service.update': { category: 'update', entity: 'Service', describe: d => `Updated service "${d.name}"` },
  'service.archive': { category: 'archive', entity: 'Service', describe: d => `Archived service "${d.name}"` },
  'service.restore': { category: 'archive', entity: 'Service', describe: d => `Restored service "${d.name}"` },
  'service.delete': { category: 'delete', entity: 'Service', describe: d => `Deleted service "${d.name}"` },
  'voucher.create': { category: 'create', entity: 'Voucher', describe: d => `Created voucher ${d.code}` },
  'voucher.activate': { category: 'update', entity: 'Voucher', describe: d => `Activated voucher ${d.code}` },
  'voucher.deactivate': { category: 'update', entity: 'Voucher', describe: d => `Deactivated voucher ${d.code}` },
  'voucher.delete': { category: 'delete', entity: 'Voucher', describe: d => `Deleted voucher ${d.code}` },
  'announcement.create': { category: 'create', entity: 'Announcement', describe: d => `Created announcement "${d.title}"` },
  'announcement.delete': { category: 'delete', entity: 'Announcement', describe: d => `Deleted announcement "${d.title}"` },
  'salary.update': { category: 'update', entity: 'User', describe: d => `Updated salary for ${d.email}: ${d.from ?? 0} → ${d.to}` },
  'supplier.create': { category: 'create', entity: 'Supplier', describe: d => `Added supplier "${d.name}"` },
  'supplier.update': { category: 'update', entity: 'Supplier', describe: d => `Updated supplier "${d.name}"` },
  'supplier.activate': { category: 'update', entity: 'Supplier', describe: d => `Activated supplier "${d.name}"` },
  'supplier.deactivate': { category: 'update', entity: 'Supplier', describe: d => `Deactivated supplier "${d.name}"` },
  'supplier.delete': { category: 'delete', entity: 'Supplier', describe: d => `Deleted supplier "${d.name}"` },
  'payment.pay': { category: 'create', entity: 'Payment', describe: d => `Paid ${d.recipientName} ₱${Number(d.amount || 0).toLocaleString('en-PH')} via bank transfer (${d.bankName} ••••${(d.accountNumber || '').slice(-4)})` },
};

export const CATEGORY_STYLE = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-amber-100 text-amber-800',
  delete: 'bg-red-100 text-red-800',
  login: 'bg-blue-100 text-blue-800',
  archive: 'bg-purple-100 text-purple-800',
};

export function formatDateTime(sqliteUtc) {
  if (!sqliteUtc) return '—';
  const date = new Date(`${sqliteUtc.replace(' ', 'T')}Z`);
  return date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

export function timeAgo(sqliteUtc) {
  if (!sqliteUtc) return '—';
  const date = new Date(`${sqliteUtc.replace(' ', 'T')}Z`);
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
