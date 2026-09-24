import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ShoppingBag, XCircle, PackageCheck, Star } from 'lucide-react';
import { api, formatPrice, statusColor } from '../api/client';
import { paymentMethodLabel } from '../constants/paymentMethods';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import OrderDetailsModal from '../components/OrderDetailsModal';
import SafeImage from '../components/SafeImage';
import CancelReasonModal from '../components/CancelReasonModal';
import TrackingModal from '../components/TrackingModal';
import ReturnRequestModal from '../components/ReturnRequestModal';
import OrderReviewModal from '../components/OrderReviewModal';

// A card lists its first few products in full — brand, name, what each one cost — and folds
// the rest into a "+N more" line, so a ten-item order can't push the totals off the screen.
// /orders/my joins name/brand/image onto every line item, so this costs no extra request.
const ITEMS_SHOWN = 3;

// A hairline of status colour along the top edge, so a column of cards can be read by colour
// before a single word of it is. Written out as whole class strings because Tailwind scans
// source text for class names and never sees one that was assembled at runtime.
const STATUS_ACCENTS = {
  pending: 'from-yellow-400 to-yellow-400/20',
  processing: 'from-blue-500 to-blue-500/20',
  shipped: 'from-purple-500 to-purple-500/20',
  delivered: 'from-green-500 to-green-500/20',
  cancelled: 'from-red-400 to-red-400/20',
  returned: 'from-orange-400 to-orange-400/20',
};
const DEFAULT_ACCENT = 'from-gray-300 to-gray-300/20';

// A live return outranks the order's own status everywhere a customer sees it. The row itself
// stays 'delivered' — the return window and the refund are both measured from that — but once
// something has gone back, "delivered" is no longer the true thing to say about the order.
// `returned` comes from /orders/my and already discounts rejected and withdrawn requests.
const displayStatus = (o) => (o.returned ? 'returned' : o.status);

// The stages a customer thinks in, mapped onto the statuses an order actually carries
// (ORDER_STEPS in backend/utils/tracking.js: pending -> processing -> shipped -> delivered).
// Every tab but All is exclusive: an order belongs to exactly one of them, so a returned order
// is filed under Returns only and does not also sit in To Review waiting to be rated.
const TABS = [
  { key: 'all', label: 'All', match: () => true, empty: 'No orders yet.' },
  { key: 'to-ship', label: 'To Ship', match: (o) => o.status === 'pending' || o.status === 'processing', empty: 'Nothing waiting to be shipped.' },
  { key: 'to-receive', label: 'To Receive', match: (o) => o.status === 'shipped', empty: 'Nothing on its way right now.' },
  { key: 'to-review', label: 'To Review', match: (o) => o.status === 'delivered' && !o.returned, empty: 'No delivered orders to review yet.' },
  { key: 'returns', label: 'Returns', match: (o) => o.returned, empty: 'No returns or refunds.' },
  { key: 'cancelled', label: 'Cancelled', match: (o) => o.status === 'cancelled', empty: 'No cancelled orders.' },
];

const DEFAULT_TAB = TABS[0].key;

function OrderCard({ order, onOpen, canReview, onReview }) {
  const items = order.items || [];
  const shown = items.slice(0, ITEMS_SHOWN);
  const hidden = items.length - shown.length;
  // Units, not line count — "3 items" should mean three things in the box, not three rows.
  const units = items.reduce((n, i) => n + (i.quantity || 0), 0);
  const status = displayStatus(order);

  // A div rather than a button, because the card carries its own action button and a button
  // inside a button is neither valid nor reachable by keyboard. Same role/tabIndex/key handling
  // the booking cards use, so the whole card still opens on Enter and Space.
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      aria-label={`Order ${order.id.slice(0, 8).toUpperCase()}, ${status}, ${formatPrice(order.total)}`}
      className="card group w-full text-left cursor-pointer hover:border-brand-navy/20 hover:shadow-lg hover:-translate-y-0.5 transition"
    >
      <div className={`h-1 bg-gradient-to-r ${STATUS_ACCENTS[status] || DEFAULT_ACCENT}`} />

      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <p className="font-display font-bold tracking-tight text-brand-ink">
            Order #{order.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}{units} item{units === 1 ? '' : 's'}
          </p>
        </div>
        <span className={`badge ${statusColor(status)}`}>{status}</span>
      </div>

      <div className="border-t border-gray-100 divide-y divide-gray-100">
        {shown.map((i, index) => (
          <div key={i.id || `${i.product_id}-${index}`} className="flex items-center gap-3.5 px-5 py-3">
            <SafeImage
              src={i.image}
              alt={i.name}
              className="w-14 h-14 shrink-0 rounded-xl object-cover bg-gray-100 ring-1 ring-gray-200/80 group-hover:ring-brand-navy/20 transition"
              iconClassName="w-5 h-5"
            />
            <div className="flex-1 min-w-0">
              {i.brand && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-teal truncate">{i.brand}</p>
              )}
              <p className="font-semibold text-sm text-brand-ink truncate">{i.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">Qty {i.quantity} × {formatPrice(i.price)}</p>
            </div>
            <p className="shrink-0 text-sm font-bold text-brand-navy">{formatPrice(i.price * i.quantity)}</p>
          </div>
        ))}
        {hidden > 0 && (
          <p className="px-5 py-2.5 text-xs font-semibold text-gray-500">
            +{hidden} more item{hidden === 1 ? '' : 's'} in this order
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-100 bg-gradient-to-r from-brand-light/70 to-transparent">
        <p className="text-xs text-gray-500 truncate">{paymentMethodLabel(order.payment_method)}</p>
        <div className="flex items-baseline gap-2.5 shrink-0">
          <span className="text-xs font-medium text-gray-500">Total</span>
          <span className="font-display text-lg font-extrabold tracking-tight text-brand-navy">{formatPrice(order.total)}</span>
          <ChevronRight className="w-4 h-4 self-center text-gray-400 group-hover:text-brand-orange group-hover:translate-x-0.5 transition" />
        </div>
      </div>

      {canReview && (
        <div className="flex justify-end px-5 py-3 border-t border-gray-100">
          <button
            type="button"
            // The card underneath opens the order details; rating is its own errand.
            onClick={(e) => { e.stopPropagation(); onReview(); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-orange/30 bg-brand-orange/5 px-3.5 py-2 text-sm font-semibold text-brand-orange hover:bg-brand-orange/10 active:scale-[0.98] transition"
          >
            <Star className="w-4 h-4" /> Add Review
          </button>
        </div>
      )}
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewedIds, setReviewedIds] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  // The tab lives in the URL so a filtered view can be linked and walked back to with the
  // browser's back button; anything unrecognised falls back to All.
  const requested = searchParams.get('tab');
  const activeKey = TABS.some(t => t.key === requested) ? requested : DEFAULT_TAB;
  const activeTab = TABS.find(t => t.key === activeKey);

  const selectTab = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === DEFAULT_TAB) next.delete('tab');
    else next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  const loadOrders = () => api.get('/orders/my').then(setOrders).catch(() => {});
  // One review per customer per product, so the set of products already rated is what decides
  // whether a delivered order still has anything to review. Fetched once for the whole list
  // rather than per card, and refreshed after posting.
  const loadReviewed = () => api.get('/reviews/my')
    .then(rows => setReviewedIds(new Set(rows.map(r => r.product_id))))
    .catch(() => setReviewedIds(new Set()));
  useEffect(() => { loadOrders(); loadReviewed(); }, []);

  const reviewableCount = (order) => (order.items || [])
    .filter(i => !reviewedIds?.has(i.product_id))
    .length;

  const counts = useMemo(
    () => Object.fromEntries(TABS.map(t => [t.key, orders.filter(t.match).length])),
    [orders],
  );
  const visible = useMemo(() => orders.filter(activeTab.match), [orders, activeTab]);

  const submitCancel = async (reason) => {
    const order = cancelTarget;
    await api.put(`/orders/${order.id}/cancel`, { reason });
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cancelled', cancel_reason: reason } : o));
    setSelectedOrder(prev => prev && prev.id === order.id ? { ...prev, status: 'cancelled', cancel_reason: reason } : prev);
    setCancelTarget(null);
    showToast({ icon: XCircle, iconClass: 'bg-red-100 text-red-600', title: 'Order cancelled', description: `Order #${order.id.slice(0, 8).toUpperCase()}` });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/account')} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-brand-navy transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <p className="eyebrow mb-3">Order History</p>
      <h1 className="section-title mb-6">My Orders</h1>

      {orders.length > 0 && (
        <div className="flex gap-6 sm:gap-8 border-b border-gray-200 overflow-x-auto no-scrollbar mb-6">
          {TABS.map(t => {
            const active = t.key === activeKey;
            return (
              <button
                key={t.key}
                onClick={() => selectTab(t.key)}
                aria-pressed={active}
                className={`flex items-center gap-2 pb-4 text-sm font-semibold transition border-b-2 -mb-px whitespace-nowrap ${active ? 'border-brand-orange text-brand-navy' : 'border-transparent text-gray-400 hover:text-brand-navy'}`}
              >
                {t.label}
                {counts[t.key] > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none transition-colors ${active ? 'bg-brand-orange/10 text-brand-orange' : 'bg-gray-100 text-gray-500'}`}>
                    {counts[t.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{activeTab.empty}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(o => (
            <OrderCard
              key={o.id}
              order={o}
              onOpen={() => setSelectedOrder(o)}
              canReview={o.status === 'delivered' && !o.returned && reviewableCount(o) > 0}
              onReview={() => setReviewTarget(o)}
            />
          ))}
        </div>
      )}

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          person={user ? { name: `${user.firstName} ${user.lastName}`, email: user.email } : null}
          personLabel="Billed To"
          onCancelOrder={setCancelTarget}
          onTrackOrder={setTrackingOrder}
          onReturnOrder={setReturnTarget}
        />
      )}

      {trackingOrder && (
        <TrackingModal
          kind="order"
          id={trackingOrder.id}
          title={`Order #${trackingOrder.id.slice(0, 8).toUpperCase()}`}
          onClose={() => setTrackingOrder(null)}
        />
      )}

      <ReturnRequestModal
        order={returnTarget}
        onClose={() => setReturnTarget(null)}
        onSubmitted={(created) => {
          setReturnTarget(null);
          setSelectedOrder(null);
          loadOrders();
          showToast({
            icon: PackageCheck,
            iconClass: 'bg-green-100 text-green-600',
            title: 'Return request submitted',
            description: `${created.ref} · we’ll email you once it’s reviewed`,
          });
        }}
      />

      <OrderReviewModal
        order={reviewTarget}
        reviewed={reviewedIds}
        onClose={() => setReviewTarget(null)}
        onSubmitted={(n) => {
          setReviewTarget(null);
          loadReviewed();
          showToast({
            icon: Star,
            iconClass: 'bg-brand-orange/10 text-brand-orange',
            title: n === 1 ? 'Review posted' : `${n} reviews posted`,
            description: 'Thanks for helping other shoppers.',
          });
        }}
      />

      <CancelReasonModal
        open={!!cancelTarget}
        title="Cancel this order?"
        message="This can't be undone once submitted. Let us know why you're cancelling."
        onSubmit={submitCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
