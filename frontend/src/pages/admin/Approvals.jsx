import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Package, Wrench, Ticket, Check, X, Clock, Users, Truck, Calendar, LifeBuoy, KeyRound, Copy } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { DEPARTMENT_LABELS, parseUtc } from '../../data/auditActions';
import { formatTicketNo } from '../../utils/ticketNumber';

const ENTITY_META = {
  product: { label: 'Product', Icon: Package },
  service: { label: 'Service', Icon: Wrench },
  voucher: { label: 'Voucher', Icon: Ticket },
  employee: { label: 'Employee', Icon: Users },
  supplier: { label: 'Supplier', Icon: Truck },
  booking: { label: 'Job Completion', Icon: Calendar },
  support: { label: 'Support Ticket', Icon: LifeBuoy },
  password_reset: { label: 'Password Reset', Icon: KeyRound },
};

// Which positions this page's requests can come from — mirrors the entity types above
// (general_staff/inventory_clerk propose products/services/vouchers, HR proposes
// employee/supplier changes, booking coordinators propose new technicians, installers
// propose job completions).
const REQUESTER_FILTERS = [
  { key: '', label: 'All' },
  { key: 'inventory_clerk', label: 'Inventory Clerk' },
  { key: 'hr', label: 'HR' },
  { key: 'booking_coordinator', label: 'Booking Coordinator' },
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
  const date = parseUtc(sqliteUtc);
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
    if (cr.action === 'create') return `${p.firstName} ${p.lastName} (${p.email}) — ${p.position ? DEPARTMENT_LABELS[p.position] || p.position : 'No department'}`;
    if (cr.action === 'update') return current ? `${current.first_name} ${current.last_name} — ${DEPARTMENT_LABELS[current.position] || current.position || 'No department'} → ${DEPARTMENT_LABELS[p.position] || p.position}` : `Move to ${DEPARTMENT_LABELS[p.position] || p.position}`;
    if (cr.action === 'archive') return who ? `Archive ${who}` : 'User no longer exists';
    if (cr.action === 'restore') return who ? `Restore ${who}` : 'User no longer exists';
    if (cr.action === 'delete') return who ? `Permanently delete ${who}` : 'User no longer exists';
    return '';
  }

  if (cr.entity_type === 'password_reset') {
    const who = current ? `${current.first_name} ${current.last_name} (${current.email})` : `${cr.requester_first_name} ${cr.requester_last_name}`;
    return cr.status === 'pending' ? `${who} forgot their password and is asking for a reset code` : `${who} — password reset`;
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
    const specCount = Object.keys(p.specifications || {}).length;
    if (specCount) bits.push(`${specCount} spec${specCount === 1 ? '' : 's'}`);
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
  // The code from a password reset that was just approved, shown straight away in a dialog —
  // the request itself moves to the Approved tab, where the code stays visible until it's used.
  const [issuedCode, setIssuedCode] = useState(null);

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
    if (cr.entity_type === 'employee' || cr.entity_type === 'password_reset') return employees.find(e => e.id === cr.entity_id);
    if (cr.entity_type === 'supplier') return suppliers.find(s => s.id === cr.entity_id);
    if (cr.entity_type === 'booking') return bookings.find(b => b.id === cr.entity_id);
    if (cr.entity_type === 'support') return tickets.find(t => t.id === cr.entity_id);
    return null;
  };

  const approve = async (id) => {
    setError('');
    try {
      const target = requests?.find(r => r.id === id);
      const result = await api.put(`/admin/approvals/${id}/approve`);
      setConfirmApproveId(null);
      if (result?.resetCode) {
        setIssuedCode({ code: result.resetCode, expiresAt: result.expiresAt, name: target ? `${target.requester_first_name} ${target.requester_last_name}` : 'the employee' });
      }
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
      isAdmin ? "Review general staff's, HR's, and installers' pending requests, plus staff password resets." :
      user?.position === 'booking_coordinator' ? "Review installers' job completions before they're finalized." :
      user?.position === 'hr' ? "Review support ticket resolutions before they're finalized." :
      "Review general staff's product, service, and voucher requests."
    }>
      <ConfirmDialog
        open={!!confirmApproveId}
        icon={Check}
        tone="create"
        title="Approve this request?"
        message={approveTarget
          ? `${describePayload(approveTarget, currentOf(approveTarget))}${approveTarget.entity_type === 'password_reset' ? '.\n\nApproving creates a one-time reset code for you to give them.' : ''}`
          : ''}
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

      {issuedCode && <IssuedCodeDialog issued={issuedCode} onClose={() => setIssuedCode(null)} />}

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
                        <span className={`badge capitalize ${ACTION_STYLE[cr.action]}`}>{cr.entity_type === 'password_reset' ? 'reset' : cr.action}</span>
                      </div>
                      <p className="text-sm text-gray-600">{describePayload(cr, currentOf(cr))}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Requested by {cr.requester_first_name} {cr.requester_last_name}{cr.requester_staff_code ? ` (${cr.requester_staff_code})` : ''} · {timeAgo(cr.created_at)}
                        {cr.status !== 'pending' && cr.reviewer_first_name && ` · ${cr.status === 'approved' ? 'Approved' : 'Rejected'} by ${cr.reviewer_first_name} ${cr.reviewer_last_name}`}
                      </p>
                      {cr.entity_type === 'password_reset' && cr.status === 'approved' && <ResetCodeStatus cr={cr} />}
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

const formatExpiry = (iso) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// A one-time reset code with a copy button. select-all lets it be copied by hand too, in case
// the browser blocks clipboard access.
function ResetCode({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the code is still on screen to copy manually.
    }
  };
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-lg font-bold tracking-[0.3em] text-brand-navy bg-white border border-gray-200 rounded-lg px-3 py-1.5 select-all">{code}</span>
      <button type="button" onClick={copy} title={copied ? 'Copied' : 'Copy code'} aria-label="Copy reset code" className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

// What an approved password reset's card shows: the code while it's still usable, otherwise
// why it isn't (used, replaced by a newer approval, or expired).
function ResetCodeStatus({ cr }) {
  const p = cr.payload || {};
  if (p.code) {
    return (
      <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Reset code</p>
        <ResetCode code={p.code} />
        <p className="text-xs text-gray-600">Give this to {cr.requester_first_name} once you've confirmed it's really them. It works once and expires {formatExpiry(p.expiresAt)}.</p>
      </div>
    );
  }
  if (p.usedAt) return <p className="mt-2 text-xs font-medium text-green-700">Code used · password changed {timeAgo(p.usedAt)}</p>;
  if (p.supersededAt) return <p className="mt-2 text-xs text-gray-400">This code was replaced by a newer reset approval.</p>;
  if (p.expired) return <p className="mt-2 text-xs text-gray-400">Code expired {formatExpiry(p.expiresAt)} — {cr.requester_first_name} will need to request a new reset.</p>;
  return null;
}

function IssuedCodeDialog({ issued, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="modal-scrim" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="issued-code-title" className="modal-panel w-full max-w-sm p-6 fade-up">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-green-100 text-green-600">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 id="issued-code-title" className="font-display text-lg font-bold text-brand-navy">Password reset approved</h2>
        <p className="text-sm text-gray-600 mt-1.5">Give this code to {issued.name}. They enter it on the staff sign-in page under <span className="font-medium">Forgot password?</span>, along with their new password.</p>
        <div className="mt-4"><ResetCode code={issued.code} /></div>
        <p className="text-xs text-gray-400 mt-2">Works once · expires {formatExpiry(issued.expiresAt)} · also shown under Approved</p>
        <button type="button" onClick={onClose} className="btn-secondary w-full mt-6 py-2.5">Done</button>
      </div>
    </div>,
    document.body
  );
}
