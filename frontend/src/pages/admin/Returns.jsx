import { useEffect, useState } from 'react';
import { RotateCcw, Check, X, PackageCheck, Image as ImageIcon, Banknote, XCircle } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import RejectReturnDialog from '../../components/RejectReturnDialog';
import SafeImage from '../../components/SafeImage';
import { timeAgo } from '../../data/auditActions';
import {
  caseRef, orderRef, isCancellation, KIND_LABEL, KIND_STYLE,
  RETURN_STATUS_STYLE, statusLabel, refundStatusLabel,
} from '../../utils/returns';

// Returns and cancellations share this queue but not its middle: a return is approved, shipped
// back, received (which is what credits stock), then paid out; a cancellation skips straight from
// approved to paid, because nothing was ever shipped and the stock went back at cancel time.
// Hence the kind filter — 'Awaiting Items' is meaningless for one of them.
const KIND_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'return', label: 'Returns' },
  { key: 'cancellation', label: 'Cancellations' },
];

// 'approved' means different work depending on kind, so the tab is named after the state itself
// and each card says what it is waiting for.
const TABS = [
  { key: 'pending', label: 'To Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'received', label: 'Received', kinds: ['return'] },
  { key: 'rejected', label: 'Rejected' },
];

const PAYMENT_LABEL = { cod: 'Cash on Delivery', bank: 'Bank Transfer', card: 'Card', gcash: 'GCash', qrph: 'QR Ph' };

// Where the money physically goes back to. COD never reaches this queue as a cancellation — no
// cash was collected before delivery — so every cancellation here has an online channel to pay.
const REFUND_CHANNEL = {
  card: 'back onto the card it was charged to',
  gcash: 'back to the customer’s GCash account',
  qrph: 'back via QR Ph to the account that paid',
  bank: 'back by bank transfer to the customer’s account',
};

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
  const [kindCounts, setKindCounts] = useState([]);
  const [kind, setKind] = useState('all');
  const [tab, setTab] = useState('pending');
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(null);
  const [receiving, setReceiving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [payingOut, setPayingOut] = useState(null);

  const load = (status = tab, forKind = kind) => api.get(`/admin/returns?status=${status}&kind=${forKind}`)
    .then((d) => { setReturns(d.returns); setCounts(d.counts); setKindCounts(d.kindCounts || []); })
    .catch(() => {});

  // Received only exists for returns, so filtering to cancellations while sitting on it would
  // show a permanently empty list with no way to tell why.
  const visibleTabs = TABS.filter((t) => !t.kinds || t.kinds.includes(kind) || kind === 'all');
  const selectKind = (next) => {
    setKind(next);
    if (!TABS.find((t) => t.key === tab && (!t.kinds || t.kinds.includes(next) || next === 'all'))) setTab('pending');
  };

  useEffect(() => { load(tab, kind); }, [tab, kind]);

  const countOf = (key) => counts.find((c) => c.status === key)?.count ?? 0;
  const kindCountOf = (key) => (key === 'all'
    ? kindCounts.reduce((n, c) => n + Number(c.count), 0)
    : Number(kindCounts.find((c) => c.kind === key)?.count ?? 0));

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
  const markRefunded = (r) => act(async () => { await api.put(`/admin/returns/${r.id}/refund-status`, { refundStatus: 'refunded' }); setPayingOut(null); });

  // A return is only payable once the goods are physically back; a cancellation is payable the
  // moment it's approved, because there are no goods to wait for.
  const canPayOut = (r) => r.refund_status === 'unpaid'
    && (isCancellation(r) ? r.status === 'approved' : r.status === 'received');

  return (
    <AdminLayout
      title="Returns &amp; Cancellations"
      subtitle="Review returned goods and cancellation refunds, then record the money going back"
    >
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-xl w-fit max-w-full overflow-x-auto no-scrollbar">
        {KIND_FILTERS.map((k) => (
          <button
            key={k.key}
            onClick={() => selectKind(k.key)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition ${kind === k.key ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-500 hover:text-brand-navy'}`}
          >
            {k.label} {kindCountOf(k.key) > 0 && <span className="opacity-50">({kindCountOf(k.key)})</span>}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {visibleTabs.map((t) => (
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
          {returns.map((r) => {
            const cancellation = isCancellation(r);
            return (
              <div key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-brand-navy bg-brand-navy/10 rounded px-1.5 py-0.5">{caseRef(r.id, r.kind)}</span>
                      <span className={`badge ${KIND_STYLE[r.kind] || KIND_STYLE.return}`}>{KIND_LABEL[r.kind] || KIND_LABEL.return}</span>
                      <p className="text-sm font-semibold text-gray-800">{r.first_name} {r.last_name}</p>
                      <span className={`badge ${RETURN_STATUS_STYLE[r.status]}`}>{statusLabel(r.kind, r.status)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Order {orderRef(r.order_id)} · {PAYMENT_LABEL[r.payment_method] || r.payment_method} · {r.email} · {timeAgo(r.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-bold text-brand-navy">{formatPrice(r.refund_amount)}</p>
                    <p className="text-xs text-gray-400">{refundStatusLabel(r.kind, r.refund_status)}</p>
                  </div>
                </div>

                {/* The clerk has to know where the money is going before they authorise it, not at
                    payout time — cash back out of the till reads very differently from a reversal
                    on a card, and a cancellation is the full order total either way. */}
                {cancellation && r.refund_status === 'unpaid' && r.status !== 'rejected' && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1">
                    <XCircle className="w-3.5 h-3.5" />
                    Order cancelled after payment — refund {formatPrice(r.refund_amount)} {REFUND_CHANNEL[r.payment_method] || 'to the original payment method'}.
                  </p>
                )}
                {!cancellation && r.payment_method === 'cod' && r.refund_status === 'unpaid' && r.status !== 'rejected' && (
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

                <p className="text-sm text-gray-600 mt-3">
                  <span className="text-gray-400">{cancellation ? 'Cancellation reason:' : 'Reason:'}</span> {r.reason}
                </p>
                {r.review_note && <p className="text-sm text-gray-600 mt-1"><span className="text-gray-400">Your note:</span> {r.review_note}</p>}
                {r.reviewer_first && (
                  <p className="text-xs text-gray-400 mt-1">
                    Reviewed by {r.reviewer_first} {r.reviewer_last} · {timeAgo(r.reviewed_at)}
                  </p>
                )}

                {r.photo_count > 0 && <PhotoStrip returnId={r.id} />}

                {/* A cancellation sits at 'approved' with nothing left but the payout, which reads
                    as stalled unless the card says so. */}
                {cancellation && r.status === 'approved' && r.refund_status === 'unpaid' && (
                  <p className="text-xs text-gray-500 mt-3">Nothing to collect — send the money, then record it below.</p>
                )}

                <div className="flex gap-2 mt-4 flex-wrap">
                  {r.status === 'pending' && (
                    <>
                      <button onClick={() => setRejecting(r)} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition">
                        <X className="w-4 h-4" /> Reject
                      </button>
                      <button onClick={() => setApproving(r)} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition">
                        <Check className="w-4 h-4" /> {cancellation ? 'Approve refund' : 'Approve'}
                      </button>
                    </>
                  )}
                  {!cancellation && r.status === 'approved' && (
                    <button onClick={() => setReceiving(r)} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-brand-navy text-white hover:bg-brand-navy/90 transition">
                      <PackageCheck className="w-4 h-4" /> Items Received — Add Stock
                    </button>
                  )}
                  {canPayOut(r) && (
                    <button onClick={() => setPayingOut(r)} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition">
                      <Banknote className="w-4 h-4" /> {cancellation ? 'Mark refund sent' : 'Mark refund paid'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!approving}
        icon={Check}
        tone="create"
        title={approving && isCancellation(approving) ? 'Approve this refund?' : 'Approve this return?'}
        message={approving
          ? (isCancellation(approving)
            ? `This authorises ${formatPrice(approving.refund_amount)} going back to ${approving.first_name} ${REFUND_CHANNEL[approving.payment_method] || 'to the original payment method'}. Record it as sent once you've actually moved the money.`
            : `${approving.first_name} will be told to send the items back. Stock is not added until you mark them received.`)
          : ''}
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

      {/* Recording a payout used to fire straight off the button. It's the step that closes a
          cancelled order's books — and, for a cancellation, emails the customer to say the money
          has gone — so it gets the same confirm step as every other irreversible action here.
          Returns don't email here: returnReceivedEmail already told that customer at 'received'. */}
      <ConfirmDialog
        open={!!payingOut}
        icon={Banknote}
        tone="update"
        title={payingOut && isCancellation(payingOut) ? 'Record this refund as sent?' : 'Record this refund as paid?'}
        message={payingOut
          ? `Only do this once ${formatPrice(payingOut.refund_amount)} has actually gone ${REFUND_CHANNEL[payingOut.payment_method] || 'back to the customer'}.${isCancellation(payingOut) ? ` ${payingOut.first_name} will be emailed to say the refund is on its way, and the order stops counting as revenue.` : ''}`
          : ''}
        confirmLabel={payingOut && isCancellation(payingOut) ? 'Mark as sent' : 'Mark as paid'}
        onConfirm={() => markRefunded(payingOut)}
        onCancel={() => setPayingOut(null)}
      />

      <RejectReturnDialog
        open={!!rejecting}
        customer={rejecting ? rejecting.first_name : ''}
        kind={rejecting ? rejecting.kind : 'return'}
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
