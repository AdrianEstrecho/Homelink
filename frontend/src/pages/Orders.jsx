import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ShoppingBag, XCircle, PackageCheck } from 'lucide-react';
import { api, formatPrice, statusColor } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import OrderDetailsModal from '../components/OrderDetailsModal';
import SafeImage from '../components/SafeImage';
import CancelReasonModal from '../components/CancelReasonModal';
import TrackingModal from '../components/TrackingModal';
import ReturnRequestModal from '../components/ReturnRequestModal';

// Up to three product shots per row, overlapped so a big order can't push the order number
// and date off the line; whatever's left over is counted in a +N chip. /orders/my already
// joins the product image onto every line item, so this costs no extra request.
const THUMBS_SHOWN = 3;

// The stages a customer thinks in, mapped onto the statuses an order actually carries
// (ORDER_STEPS in backend/utils/tracking.js: pending -> processing -> shipped -> delivered).
// 'All' keeps everything, cancelled orders included, so nothing is stranded off-screen.
// Returns catches anything the customer has asked to send back (returnCount, from /orders/my)
// as well as an order whose money has gone back in full (payment_status 'refunded'), since a
// fully refunded order is a return whether or not a request row exists for it.
const TABS = [
  { key: 'all', label: 'All', match: () => true, empty: 'No orders yet.' },
  { key: 'to-ship', label: 'To Ship', match: (o) => o.status === 'pending' || o.status === 'processing', empty: 'Nothing waiting to be shipped.' },
  { key: 'to-receive', label: 'To Receive', match: (o) => o.status === 'shipped', empty: 'Nothing on its way right now.' },
  { key: 'to-review', label: 'To Review', match: (o) => o.status === 'delivered', empty: 'No delivered orders to review yet.' },
  { key: 'returns', label: 'Returns', match: (o) => o.returnCount > 0 || o.payment_status === 'refunded', empty: 'No returns or refunds.' },
];

const DEFAULT_TAB = TABS[0].key;

function OrderThumbs({ items }) {
  if (!items?.length) return null;
  const shown = items.slice(0, THUMBS_SHOWN);
  const extra = items.length - shown.length;

  return (
    <div className="flex items-center shrink-0">
      {shown.map((i, index) => (
        <SafeImage
          key={i.id || `${i.product_id}-${index}`}
          src={i.image}
          alt={i.name}
          className={`w-12 h-12 rounded-lg object-cover bg-gray-100 ring-2 ring-white ${index ? '-ml-4' : ''}`}
          iconClassName="w-5 h-5"
        />
      ))}
      {extra > 0 && (
        <span className="w-12 h-12 -ml-4 rounded-lg ring-2 ring-white bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500">
          +{extra}
        </span>
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
  useEffect(() => { loadOrders(); }, []);

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
        <div className="space-y-3">
          {visible.map(o => (
            <button
              key={o.id}
              onClick={() => setSelectedOrder(o)}
              className="card p-5 w-full text-left flex flex-wrap items-center justify-between gap-3 hover:border-brand-navy/20 hover:shadow-md transition"
            >
              <div className="flex items-center gap-4 min-w-0">
                <OrderThumbs items={o.items} />
                <div className="min-w-0">
                  <p className="font-semibold text-brand-ink">Order #{o.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(o.created_at).toLocaleDateString()} · {o.items?.length || 0} item{o.items?.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${statusColor(o.status)}`}>{o.status}</span>
                <span className="font-bold text-brand-navy">{formatPrice(o.total)}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
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
