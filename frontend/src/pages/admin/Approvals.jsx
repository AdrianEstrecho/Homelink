import { useEffect, useMemo, useState } from 'react';
import { Package, Wrench, Ticket, Check, X, Clock, Users, Truck, Wallet, Send, Calendar, LifeBuoy } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { POSITION_LABELS } from '../../data/auditActions';
import { formatTicketNo } from '../../utils/ticketNumber';

const ENTITY_META = {
  product: { label: 'Product', Icon: Package },
  service: { label: 'Service', Icon: Wrench },
  voucher: { label: 'Voucher', Icon: Ticket },
  employee: { label: 'Employee', Icon: Users },
  supplier: { label: 'Supplier', Icon: Truck },
  salary: { label: 'Salary', Icon: Wallet },
  payment: { label: 'Payment', Icon: Send },
  booking: { label: 'Job Completion', Icon: Calendar },
  support: { label: 'Support Ticket', Icon: LifeBuoy },
};

// Which positions this page's requests can come from — mirrors the entity types above
// (general_staff/inventory_clerk propose products/services/vouchers, HR proposes
// employee/supplier changes, Accounting proposes salary/payment changes, installers
// propose job completions).
const REQUESTER_FILTERS = [
  { key: '', label: 'All' },
  { key: 'inventory_clerk', label: 'Inventory Clerk' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'hr', label: 'HR' },
  { key: 'general_staff', label: 'General Staff' },
  { key: 'installer', label: 'Installer' },
];

const ACTION_STYLE = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-amber-100 text-amber-800',
  delete: 'bg-red-100 text-red-800',
  archive: 'bg-purple-100 text-purple-800',
  restore: 'bg-purple-100 text-purple-800',
};

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function timeAgo(sqliteUtc) {
  if (!sqliteUtc) return '—';
  const date = new Date(`${sqliteUtc.replace(' ', 'T')}Z`);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// Summarizes what's being proposed for a request, using the live entity (for
// update/delete, since payload alone doesn't show what's changing) as context.
function describePayload(cr, current) {
  const p = cr.payload || {};

  // Employee requests cover five actions (create/update/archive/restore/delete), so they're
  // handled together here rather than split across the create/update and delete branches below.
  if (cr.entity_type === 'employee') {
    const who = current ? `${current.first_name} ${current.last_name} (${current.email})` : null;
    if (cr.action === 'create') return `${p.firstName} ${p.lastName} (${p.email}) — ${p.position ? POSITION_LABELS[p.position] || p.position : 'No position'}`;
    if (cr.action === 'update') return current ? `${current.first_name} ${current.last_name} — ${POSITION_LABELS[current.position] || current.position || 'No position'} → ${POSITION_LABELS[p.position] || p.position}` : `Promote to ${POSITION_LABELS[p.position] || p.position}`;
    if (cr.action === 'archive') return who ? `Archive ${who}` : 'User no longer exists';
    if (cr.action === 'restore') return who ? `Restore ${who}` : 'User no longer exists';
    if (cr.action === 'delete') return who ? `Permanently delete ${who}` : 'User no longer exists';
    return '';
  }

  if (cr.entity_type === 'salary') {
    const changes = Array.isArray(p.changes) ? p.changes : [];
    return changes.map(c => `${c.employeeName || 'Employee'}: ${formatPrice(c.fromSalary ?? 0)} → ${formatPrice(c.salary ?? 0)}`).join(', ');
  }

  if (cr.entity_type === 'payment') {
    const last4 = p.accountNumber ? `••••${String(p.accountNumber).slice(-4)}` : '';
    return `Pay ${p.recipientName || 'recipient'} (${p.recipientType}) ${formatPrice(p.amount ?? 0)} — ${p.bankName || 'bank'} ${last4}`;
  }

  if (cr.entity_type === 'booking') {
    const who = current ? `${current.first_name} ${current.last_name}` : 'a customer';
    const service = current?.service_name || 'Service';
    return `"${service}" for ${who} — mark Installed Completed${p.completionNotes ? ` · "${p.completionNotes}"` : ''}`;
  }

  if (cr.entity_type === 'support') {
    const who = current ? `${current.first_name} ${current.last_name}` : 'a customer';
    return current ? `${formatTicketNo(current.ticket_number)} — "${current.subject}" (${who}) — mark Resolved` : 'Ticket no longer exists';
  }

  if (cr.action === 'delete') {
    if (cr.entity_type === 'product') return current ? `"${current.name}" — ${formatPrice(current.price)}, stock ${current.stock}` : 'Product no longer exists';
    if (cr.entity_type === 'service') return current ? `"${current.name}" — ${formatPrice(current.base_price)}` : 'Service no longer exists';
    if (cr.entity_type === 'voucher') return current ? `${current.code} — ${current.discount_type === 'percent' ? `${current.discount_value}%` : formatPrice(current.discount_value)} off` : 'Voucher no longer exists';
    if (cr.entity_type === 'supplier') return current ? `"${current.name}"${current.category ? ` — ${current.category}` : ''}` : 'Supplier no longer exists';
    return '';
  }
  if (cr.entity_type === 'product') {
    const bits = [formatPrice(p.price), p.brand || null, p.status === 'inactive' ? 'Inactive' : 'Active'];
    if (cr.action === 'update' && Number(p.addStock) > 0) bits.push(`+${p.addStock} stock`);
    if (cr.action === 'update' && current && Number(current.price) !== Number(p.price)) bits.push(`was ${formatPrice(current.price)}`);
    return `"${p.name}" — ${bits.filter(Boolean).join(' · ')}`;
  }
  if (cr.entity_type === 'service') {
    const bits = [p.category, formatPrice(p.basePrice)];
    if (cr.action === 'update' && current && Number(current.base_price) !== Number(p.basePrice)) bits.push(`was ${formatPrice(current.base_price)}`);
    return `"${p.name}" — ${bits.filter(Boolean).join(' · ')}`;
  }
  if (cr.entity_type === 'voucher') {
    const discount = p.discountType === 'percent' ? `${p.discountValue}%` : formatPrice(p.discountValue);
    return `${p.code} — ${discount} off`;
  }
  if (cr.entity_type === 'supplier') {
    const bits = [p.category, p.contactName].filter(Boolean);
    return `"${p.name}"${bits.length ? ` — ${bits.join(' · ')}` : ''}`;
  }
  return '';
}

export default function Approvals() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('pending');
  const [requesterFilter, setRequesterFilter] = useState('');
  const [requests, setRequests] = useState(null);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tickets, setTickets] = useState([]);
  const canReviewCatalog = isAdmin || user?.position === 'inventory_clerk';
  const canReviewBookings = isAdmin || user?.position === 'booking_coordinator';
  const canReviewSupport = isAdmin || user?.position === 'hr';
  const [confirmApproveId, setConfirmApproveId] = useState(null);
  const [confirmRejectId, setConfirmRejectId] = useState(null);
  const [error, setError] = useState('');

  // Employee/supplier requests (and their lookups) are admin-only — inventory clerks never
  // see them, so there's no reason for them to fetch /admin/users or /admin/suppliers here.
  // Products/services/vouchers are only relevant to admin and inventory clerks; bookings
  // only to admin and booking coordinators; support tickets only to admin and HR — same
  // idea, gated the same way.
  const loadLookups = () => {
    if (canReviewCatalog) {
      api.get('/admin/products').then(setProducts).catch(() => {});
      api.get('/admin/services').then(setServices).catch(() => {});
      api.get('/admin/vouchers').then(setVouchers).catch(() => {});
    }
    if (isAdmin) {
      api.get('/admin/users').then(setEmployees).catch(() => {});
      api.get('/admin/suppliers').then(setSuppliers).catch(() => {});
    }
    if (canReviewBookings) {
      api.get('/admin/bookings').then(setBookings).catch(() => {});
    }
    if (canReviewSupport) {
      api.get('/admin/support-messages').then(setTickets).catch(() => {});
    }
  };
  useEffect(loadLookups, [isAdmin, canReviewCatalog, canReviewBookings, canReviewSupport]);

  const load = () => api.get(`/admin/approvals?status=${tab}`).then(setRequests).catch(() => {});
  useEffect(() => { setRequests(null); load(); }, [tab]);

  const currentOf = (cr) => {
    if (cr.entity_type === 'product') return products.find(p => p.id === cr.entity_id);
    if (cr.entity_type === 'service') return services.find(s => s.id === cr.entity_id);
    if (cr.entity_type === 'voucher') return vouchers.find(v => v.id === cr.entity_id);
    if (cr.entity_type === 'employee') return employees.find(e => e.id === cr.entity_id);
    if (cr.entity_type === 'supplier') return suppliers.find(s => s.id === cr.entity_id);
    if (cr.entity_type === 'booking') return bookings.find(b => b.id === cr.entity_id);
    if (cr.entity_type === 'support') return tickets.find(t => t.id === cr.entity_id);
    return null;
  };

  const approve = async (id) => {
    setError('');
    try {
      await api.put(`/admin/approvals/${id}/approve`);
      setConfirmApproveId(null);
      load();
      loadLookups();
    } catch (err) {
      setError(err.message);
      setConfirmApproveId(null);
    }
  };

  const reject = async (id) => {
    setError('');
    try {
      await api.put(`/admin/approvals/${id}/reject`, {});
      setConfirmRejectId(null);
      load();
    } catch (err) {
      setError(err.message);
      setConfirmRejectId(null);
    }
  };

  const approveTarget = useMemo(() => requests?.find(r => r.id === confirmApproveId), [requests, confirmApproveId]);
  const rejectTarget = useMemo(() => requests?.find(r => r.id === confirmRejectId), [requests, confirmRejectId]);

  const filteredRequests = useMemo(() => {
    if (!requests) return null;
    return requesterFilter ? requests.filter(r => r.requester_position === requesterFilter) : requests;
  }, [requests, requesterFilter]);

  return (
    <AdminLayout title="Approvals" subtitle={
      isAdmin ? "Review general staff's, HR's, and installers' pending requests." :
      user?.position === 'booking_coordinator' ? "Review installers' job completions before they're finalized." :
      user?.position === 'hr' ? "Review support ticket resolutions before they're finalized." :
      "Review general staff's product, service, and voucher requests."
    }>
      <ConfirmDialog
        open={!!confirmApproveId}
        icon={Check}
        tone="create"
        title="Approve this request?"
        message={approveTarget ? describePayload(approveTarget, currentOf(approveTarget)) : ''}
        confirmLabel="Approve"
        onConfirm={() => approve(confirmApproveId)}
        onCancel={() => setConfirmApproveId(null)}
      />
      <ConfirmDialog
        open={!!confirmRejectId}
        icon={X}
        tone="delete"
        title="Reject this request?"
        message={rejectTarget ? describePayload(rejectTarget, currentOf(rejectTarget)) : ''}
        confirmLabel="Reject"
        onConfirm={() => reject(confirmRejectId)}
        onCancel={() => setConfirmRejectId(null)}
      />

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 uppercase tracking-wide">From</span>
            {REQUESTER_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setRequesterFilter(f.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${requesterFilter === f.key ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {filteredRequests === null ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>
      ) : filteredRequests.length === 0 ? (
        <div className="card p-10 text-center">
          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No {tab} requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map(cr => {
            const { label: entityLabel, Icon } = ENTITY_META[cr.entity_type] || {};
            return (
              <div key={cr.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-brand-navy/10 flex items-center justify-center shrink-0">
                      {Icon && <Icon className="w-4 h-4 text-brand-navy" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-gray-800">{entityLabel}</span>
                        <span className={`badge capitalize ${ACTION_STYLE[cr.action]}`}>{cr.action}</span>
                      </div>
                      <p className="text-sm text-gray-600">{describePayload(cr, currentOf(cr))}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Requested by {cr.requester_first_name} {cr.requester_last_name}{cr.requester_staff_code ? ` (${cr.requester_staff_code})` : ''} · {timeAgo(cr.created_at)}
                        {cr.status !== 'pending' && cr.reviewer_first_name && ` · ${cr.status === 'approved' ? 'Approved' : 'Rejected'} by ${cr.reviewer_first_name} ${cr.reviewer_last_name}`}
                      </p>
                    </div>
                  </div>
                  {cr.status === 'pending' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setConfirmRejectId(cr.id)} title="Reject" className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"><X className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setConfirmApproveId(cr.id)} title="Approve" className="p-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition"><Check className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
