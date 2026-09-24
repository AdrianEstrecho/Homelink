import { useEffect, useState } from 'react';
import { RotateCcw, Check, X, PackageCheck, Image as ImageIcon, Banknote } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import RejectReturnDialog from '../../components/RejectReturnDialog';
import SafeImage from '../../components/SafeImage';
import { timeAgo } from '../../data/auditActions';
import { returnRef, orderRef, RETURN_STATUS_STYLE, RETURN_STATUS_LABEL, REFUND_STATUS_LABEL } from '../../utils/returns';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Awaiting Items' },
  { key: 'received', label: 'Received' },
  { key: 'rejected', label: 'Rejected' },
];

const PAYMENT_LABEL = { cod: 'Cash on Delivery', bank: 'Bank Transfer', card: 'Card', gcash: 'GCash', qrph: 'QR Ph' };

// Photos are excluded from the list query on purpose (base64 would make every page load
// multi-megabyte), so each card pulls its own the first time a clerk asks for them.
function PhotoStrip({ returnId }) {
  const [photos, setPhotos] = useState(null);
  const [open, setOpen] = useState(false);

  const show = () => {
    setOpen(true);
    if (photos === null) api.get(`/admin/returns/${returnId}/photos`).then(setPhotos).catch(() => setPhotos([]));
  };

  if (!open) {
    return (
      <button onClick={show} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-navy hover:underline">
        <ImageIcon className="w-3.5 h-3.5" /> View customer photos
      </button>
    );
  }
  if (photos === null) return <p className="mt-3 text-xs text-gray-400">Loading photos...</p>;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {photos.map((p) => (
        <a key={p.id} href={p.image} target="_blank" rel="noreferrer">
          <SafeImage src={p.image} alt="Returned product" className="w-24 h-24 rounded-lg object-cover bg-gray-100 hover:opacity-90 transition" iconClassName="w-5 h-5" />
        </a>
      ))}
    </div>
  );
}

export default function AdminReturns() {
  const [returns, setReturns] = useState([]);
  const [counts, setCounts] = useState([]);
  const [tab, setTab] = useState('pending');
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(null);
  const [receiving, setReceiving] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const load = (status = tab) => api.get(`/admin/returns?status=${status}`)
    .then((d) => { setReturns(d.returns); setCounts(d.counts); })
    .catch(() => {});

  useEffect(() => { load(tab); }, [tab]);

  const countOf = (key) => counts.find((c) => c.status === key)?.count ?? 0;

  const act = async (fn) => {
    setError('');
    try {
      await fn();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const approve = (r) => act(async () => { await api.put(`/admin/returns/${r.id}/approve`, {}); setApproving(null); });
  const receive = (r) => act(async () => { await api.put(`/admin/returns/${r.id}/receive`, {}); setReceiving(null); });
  const reject = (r, note) => act(async () => { await api.put(`/admin/returns/${r.id}/reject`, { note }); setRejecting(null); });
  const markRefunded = (r) => act(() => api.put(`/admin/returns/${r.id}/refund-status`, { refundStatus: 'refunded' }));

  return (
    <AdminLayout title="Returns &amp; Refunds" subtitle="Review return requests, then add stock back once the items arrive">
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map((t) => (
          <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label} {countOf(t.key) > 0 && <span className="opacity-60">({countOf(t.key)})</span>}
          </TabButton>
        ))}
      </div>

      {returns.length === 0 ? (
        <div className="card p-10 text-center">
          <RotateCcw className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nothing here right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-brand-navy bg-brand-navy/10 rounded px-1.5 py-0.5">{returnRef(r.id)}</span>
                    <p className="text-sm font-semibold text-gray-800">{r.first_name} {r.last_name}</p>
                    <span className={`badge ${RETURN_STATUS_STYLE[r.status]}`}>{RETURN_STATUS_LABEL[r.status]}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Order {orderRef(r.order_id)} · {PAYMENT_LABEL[r.payment_method] || r.payment_method} · {r.email} · {timeAgo(r.created_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-bold text-brand-navy">{formatPrice(r.refund_amount)}</p>
                  <p className="text-xs text-gray-400">{REFUND_STATUS_LABEL[r.refund_status]}</p>
                </div>
              </div>

              {/* COD means the refund is physical cash going back out, so the clerk should see it
                  before approving rather than discovering it at payout time. */}
              {r.payment_method === 'cod' && r.refund_status === 'unpaid' && r.status !== 'rejected' && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                  <Banknote className="w-3.5 h-3.5" /> Paid in cash on delivery — this refund is cash back to the customer.
                </p>
              )}
              {r.refund_status === 'not_applicable' && (
                <p className="mt-2 text-xs text-gray-500">No payment was collected on this order — nothing to refund.</p>
              )}

              <div className="mt-3 space-y-1.5">
                {r.items.map((i, idx) => (
                  <p key={idx} className="text-sm text-gray-700">
                    {i.name} <span className="text-gray-400">&times;{i.quantity}</span>
                    {i.archived ? <span className="ml-2 badge bg-gray-100 text-gray-600">archived</span> : null}
                  </p>
                ))}
              </div>

              <p className="text-sm text-gray-600 mt-3"><span className="text-gray-400">Reason:</span> {r.reason}</p>
              {r.review_note && <p className="text-sm text-gray-600 mt-1"><span className="text-gray-400">Your note:</span> {r.review_note}</p>}
              {r.reviewer_first && (
                <p className="text-xs text-gray-400 mt-1">
                  Reviewed by {r.reviewer_first} {r.reviewer_last} · {timeAgo(r.reviewed_at)}
                </p>
              )}

              {r.photo_count > 0 && <PhotoStrip returnId={r.id} />}

              <div className="flex gap-2 mt-4 flex-wrap">
                {r.status === 'pending' && (
                  <>
                    <button onClick={() => setRejecting(r)} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition">
                      <X className="w-4 h-4" /> Reject
                    </button>
                    <button onClick={() => setApproving(r)} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition">
                      <Check className="w-4 h-4" /> Approve
                    </button>
                  </>
                )}
                {r.status === 'approved' && (
                  <button onClick={() => setReceiving(r)} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-brand-navy text-white hover:bg-brand-navy/90 transition">
                    <PackageCheck className="w-4 h-4" /> Items Received — Add Stock
                  </button>
                )}
                {r.status === 'received' && r.refund_status === 'unpaid' && (
                  <button onClick={() => markRefunded(r)} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition">
                    <Banknote className="w-4 h-4" /> Mark refund paid
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!approving}
        icon={Check}
        tone="create"
        title="Approve this return?"
        message={approving ? `${approving.first_name} will be told to send the items back. Stock is not added until you mark them received.` : ''}
        confirmLabel="Approve"
        onConfirm={() => approve(approving)}
        onCancel={() => setApproving(null)}
      />

      <ConfirmDialog
        open={!!receiving}
        icon={PackageCheck}
        tone="update"
        title="Confirm the items are back?"
        message={receiving ? `This adds ${receiving.items.reduce((n, i) => n + i.quantity, 0)} unit(s) back into stock straight away. Only do this once the items are physically here.` : ''}
        confirmLabel="Add stock back"
        onConfirm={() => receive(receiving)}
        onCancel={() => setReceiving(null)}
      />

      <RejectReturnDialog
        open={!!rejecting}
        customer={rejecting ? rejecting.first_name : ''}
        onSubmit={(note) => reject(rejecting, note)}
        onCancel={() => setRejecting(null)}
      />
    </AdminLayout>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${active ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  );
}
