import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ChevronRight, ShoppingBag, XCircle, PackageCheck, PackageOpen, Star, Banknote,
  Clock, Truck, RotateCcw, CircleCheckBig, LayoutGrid, Check, SearchX,
} from 'lucide-react';
import { api, formatPrice, statusColor } from '../api/client';
import { paymentMethodLabel } from '../constants/paymentMethods';
import { getCategoryIcon } from '../constants/categoryIcons';
import { RETURN_WINDOW_DAYS } from '../utils/returns';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import OrderDetailsModal from '../components/OrderDetailsModal';
import SafeImage from '../components/SafeImage';
import CancelReasonModal from '../components/CancelReasonModal';
import ConfirmDialog from '../components/ConfirmDialog';
import TrackingModal from '../components/TrackingModal';
import ReturnRequestModal from '../components/ReturnRequestModal';
import OrderReviewModal from '../components/OrderReviewModal';
import StarRating from '../components/account/StarRating';
import { Skeleton } from '../components/Skeleton';
import { FilterSidebar, HistorySearch, searchTerms, matchesTerms } from '../components/history/HistoryFilters';

// A card lists its first few products in full — brand, name, what each one cost — and folds
// the rest into a "+N more" line, so a ten-item order can't push the totals off the screen.
// /orders/my joins name/brand/image onto every line item, so this costs no extra request.
const ITEMS_SHOWN = 3;

const orderRef = (o) => o.id.slice(0, 8).toUpperCase();
const shortDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

// Completion is the customer's sign-off on a delivered order (PUT /orders/:id/complete). The row
// stays 'delivered' server-side, so it's completed_at — not status — that says it happened.
const isCompleted = (o) => o.status === 'delivered' && !!o.completed_at;

// A live return outranks the order's own status everywhere a customer sees it. The row itself
// stays 'delivered' — the return window and the refund are both measured from that — but once
// something has gone back, "delivered" is no longer the true thing to say about the order.
// `returned` comes from /orders/my and already discounts rejected and withdrawn requests. It is
// also set by payment_status 'refunded', which a cancelled order reaches once its cancellation
// refund is paid out — that order was never delivered, so it stays filed as cancelled.
const isReturned = (o) => !!o.returned && o.status !== 'cancelled';
const displayStatus = (o) => (isReturned(o) ? 'returned' : isCompleted(o) ? 'completed' : o.status);

// Mirrors returnWindowClosesAt() in backend/utils/returns.js — only ever used for the hint under
// a delivered order. Whether a return is actually allowed is still the server's canReturn.
const returnWindowClosesAt = (o) => {
  const closes = new Date(o.delivered_at || o.created_at);
  closes.setDate(closes.getDate() + RETURN_WINDOW_DAYS);
  return closes;
};

// How each status looks on a card: the icon tile beside the reference, and the badge. Completed
// gets teal rather than statusColor()'s green so it can't be mistaken for delivered in the same
// list. Written out as whole class strings because Tailwind scans source text for class names
// and never sees one that was assembled at runtime.
const STATUS_META = {
  pending: { label: 'Pending', icon: Clock, tile: 'bg-yellow-100 text-yellow-700' },
  processing: { label: 'Processing', icon: PackageOpen, tile: 'bg-blue-100 text-blue-700' },
  shipped: { label: 'Shipped', icon: Truck, tile: 'bg-purple-100 text-purple-700' },
  delivered: { label: 'Delivered', icon: PackageCheck, tile: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', icon: CircleCheckBig, tile: 'bg-teal-100 text-teal-700', badge: 'bg-teal-100 text-teal-800' },
  returned: { label: 'Returned', icon: RotateCcw, tile: 'bg-orange-100 text-orange-700' },
  cancelled: { label: 'Cancelled', icon: XCircle, tile: 'bg-red-100 text-red-600' },
};

// The stages a customer thinks in, mapped onto the statuses an order actually carries
// (ORDER_STEPS in backend/utils/tracking.js: pending -> processing -> shipped -> delivered),
// plus the customer's own completion at the end. Every tab but All is exclusive: an order
// belongs to exactly one of them, so a returned order is filed under Returns only and does not
// also sit in To Review waiting to be rated.
const TABS = [
  { key: 'all', label: 'All orders', icon: LayoutGrid, match: () => true, empty: 'No orders yet.' },
  { key: 'to-ship', label: 'To Ship', icon: Clock, match: (o) => o.status === 'pending' || o.status === 'processing', empty: 'Nothing waiting to be shipped.' },
  { key: 'to-receive', label: 'To Receive', icon: Truck, match: (o) => o.status === 'shipped', empty: 'Nothing on its way right now.' },
  { key: 'to-review', label: 'To Review', icon: Star, match: (o) => o.status === 'delivered' && !isReturned(o) && !o.completed_at, empty: 'No delivered orders waiting on you.' },
  { key: 'returns', label: 'Returns', icon: RotateCcw, match: isReturned, empty: 'No returns yet. Cancellation refunds are tracked under Returns & Cancellations in your account.' },
  { key: 'completed', label: 'Completed', icon: CircleCheckBig, match: (o) => isCompleted(o) && !isReturned(o), empty: 'No completed orders yet. Mark a delivered order as completed once you’re happy with it.' },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle, match: (o) => o.status === 'cancelled', empty: 'No cancelled orders.' },
];

const DEFAULT_TAB = TABS[0].key;
const ALL = '';
const OTHER = 'other';

// The top-level categories an order touches, one entry each however many lines share it. A
// product that lost its category files under Other rather than vanishing from every filter.
const categoriesOf = (o) => {
  const seen = new Map();
  (o.items || []).forEach((i) => {
    const key = i.category_slug || OTHER;
    if (!seen.has(key)) seen.set(key, i.category || 'Other');
  });
  return [...seen.entries()].map(([key, label]) => ({ key, label }));
};

// Everything a customer might type to find an order again: the reference from the receipt
// email, what was in it, and how it was paid for.
const orderHaystack = (o) => [
  orderRef(o),
  paymentMethodLabel(o.payment_method),
  STATUS_META[displayStatus(o)]?.label,
  ...(o.items || []).flatMap((i) => [i.name, i.brand, i.category]),
];

// The progress rail: where this order is in its trip from checkout to the customer's hands.
// The fifth stop is the customer's own — Completed when they sign off, Returned when something
// went back instead. A cancelled order never travelled, so it gets a single line saying so.
const JOURNEY = [
  { key: 'pending', label: 'Placed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

function OrderJourney({ order, status }) {
  if (status === 'cancelled') {
    return (
      <div className="mx-5 mb-4 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50/80 px-3.5 py-3">
        <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
        <p className="text-sm text-red-800 min-w-0">
          <span className="font-semibold">Cancelled</span>
          {order.cancel_reason && <span className="text-red-700/90"> · “{order.cancel_reason}”</span>}
        </p>
      </div>
    );
  }

  const returned = status === 'returned';
  const steps = [...JOURNEY, returned ? { key: 'returned', label: 'Returned' } : { key: 'completed', label: 'Completed' }];
  const current = returned || status === 'completed' ? 4 : JOURNEY.findIndex((s) => s.key === order.status);

  return (
    <ol className="mx-5 mb-4 flex items-start rounded-xl border border-gray-100 bg-gray-50/70 px-2 pt-3 pb-2.5" aria-label="Order progress">
      {steps.map((s, i) => {
        const done = i <= current;
        const here = i === current;
        // The returned stop is the only one that isn't forward progress, so it alone turns orange.
        const tone = s.key === 'returned' ? 'orange' : 'teal';
        const dot = done
          ? (tone === 'orange' ? 'bg-brand-orange border-brand-orange' : 'bg-brand-teal border-brand-teal')
          : 'bg-white border-gray-300';
        const halo = here ? (tone === 'orange' ? 'ring-4 ring-brand-orange/15' : 'ring-4 ring-brand-teal/15') : '';
        return (
          <li key={s.key} className="relative flex flex-1 flex-col items-center" aria-current={here ? 'step' : undefined}>
            {i > 0 && (
              <span className={`absolute top-[7px] right-1/2 h-0.5 w-full ${i <= current ? (tone === 'orange' ? 'bg-gradient-to-r from-brand-teal to-brand-orange' : 'bg-brand-teal') : 'bg-gray-200'}`} />
            )}
            <span className={`relative z-10 grid h-4 w-4 place-items-center rounded-full border-2 transition ${dot} ${halo}`}>
              {done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
            </span>
            <span className={`mt-1.5 text-[10px] sm:text-[11px] font-semibold leading-tight text-center ${here ? 'text-brand-navy' : done ? 'text-gray-500' : 'text-gray-300'}`}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// One line of plain truth under the items: what is happening with the order now, or what the
// customer can still do about it.
function orderHint(order, status) {
  switch (status) {
    case 'pending': return { icon: Clock, text: 'Awaiting confirmation · you can still cancel' };
    case 'processing': return { icon: PackageOpen, text: 'Being packed for shipping' };
    case 'shipped': return { icon: Truck, text: 'On its way to you' };
    case 'delivered': return order.canReturn
      ? { icon: RotateCcw, text: `Returns open until ${shortDate(returnWindowClosesAt(order))}` }
      : { icon: PackageCheck, text: order.delivered_at ? `Delivered ${shortDate(order.delivered_at)}` : 'Delivered' };
    case 'completed': return { icon: CircleCheckBig, text: `Completed ${shortDate(order.completed_at)}` };
    case 'returned': return order.payment_status === 'refunded'
      ? { icon: Banknote, text: `Refunded to ${paymentMethodLabel(order.payment_method)}` }
      : { icon: RotateCcw, text: 'Return in progress' };
    // Cancelling a paid order files a refund; a COD or unverified-bank order took nothing.
    default:
      if (order.payment_status === 'refunded') return { icon: Banknote, text: `Refunded to ${paymentMethodLabel(order.payment_method)}` };
      if (order.payment_status === 'paid') return { icon: Banknote, text: 'Refund in progress' };
      return { icon: XCircle, text: 'Nothing was charged' };
  }
}

// Centred so a label still sits right when a phone stretches the button across the footer.
const ACTION_BTN = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold active:scale-[0.98] transition';
const ACTION_ICON = 'w-4 h-4 shrink-0';

function OrderCard({ order, onOpen, reviews, canReview, canComplete, canRefund, canTrack, onReview, onComplete, onRefund, onTrack, onViewReturn }) {
  const items = order.items || [];
  const shown = items.slice(0, ITEMS_SHOWN);
  const hidden = items.slice(ITEMS_SHOWN);
  // Units, not line count — "3 items" should mean three things in the box, not three rows.
  const units = items.reduce((n, i) => n + (i.quantity || 0), 0);
  const status = displayStatus(order);
  const meta = STATUS_META[status] || STATUS_META.pending;
  const StatusIcon = meta.icon;
  const hint = orderHint(order, status);
  const HintIcon = hint.icon;

  // The card underneath opens the order details; every footer action is its own errand.
  const act = (fn) => (e) => { e.stopPropagation(); fn(); };

  // From sm up the delivered-order actions are one right-aligned row, the refund icon last. A
  // phone can't fit all three, so there Add Review takes its own row and Mark as Completed
  // stretches across the one beneath, with the refund icon still at its right-hand end.
  const closeOut = canComplete || canRefund;
  const actionsClass = canReview || closeOut
    ? 'flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto sm:flex-nowrap sm:ml-auto'
    : 'flex flex-wrap items-center gap-2 ml-auto';

  // A div rather than a button, because the card carries its own action buttons and a button
  // inside a button is neither valid nor reachable by keyboard. Same role/tabIndex/key handling
  // the booking cards use, so the whole card still opens on Enter and Space.
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); } }}
      aria-label={`Order ${orderRef(order)}, ${meta.label}, ${formatPrice(order.total)}`}
      className="card group w-full text-left cursor-pointer hover:border-brand-navy/15 hover:shadow-[0_14px_40px_-14px_rgba(15,43,91,0.28)] hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3.5 px-5 pt-5 pb-4">
        <div className={`grid place-items-center w-11 h-11 shrink-0 rounded-xl ${meta.tile}`}>
          <StatusIcon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="font-display font-bold tracking-tight text-brand-ink">
              Order <span className="font-mono text-[0.95em] tracking-normal">#{orderRef(order)}</span>
            </p>
            <span className={`badge ${meta.badge || statusColor(status)}`}>{meta.label}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 truncate">
            Placed {shortDate(order.created_at)} · {units} item{units === 1 ? '' : 's'} · {paymentMethodLabel(order.payment_method)}
          </p>
        </div>
        <div className="hidden sm:block text-right shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Total</p>
          <p className="font-display text-xl font-extrabold tracking-tight text-brand-navy">{formatPrice(order.total)}</p>
        </div>
      </div>

      <OrderJourney order={order} status={status} />

      <div className="border-t border-gray-100 divide-y divide-gray-100">
        {shown.map((i, index) => {
          const CategoryIcon = getCategoryIcon(i.category_slug);
          const review = order.status === 'delivered' ? reviews?.get(i.product_id) : null;
          return (
            <div key={i.id || `${i.product_id}-${index}`} className="flex items-center gap-3.5 px-5 py-3">
              <SafeImage
                src={i.image}
                alt={i.name}
                className="w-14 h-14 shrink-0 rounded-xl object-cover bg-gray-100 ring-1 ring-gray-200/80 group-hover:ring-brand-navy/20 transition"
                iconClassName="w-5 h-5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  {i.brand && (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-teal truncate">{i.brand}</p>
                  )}
                  {i.category && (
                    <span className="hidden sm:inline-flex items-center gap-1 shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                      <CategoryIcon className="w-3 h-3" /> {i.category}
                    </span>
                  )}
                </div>
                <p className="font-semibold text-sm text-brand-ink truncate">{i.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">Qty {i.quantity} × {formatPrice(i.price)}</p>
                {/* A review belongs to the product, not to one order of it, so it shows on any
                    delivered order carrying that product — the same rule that stops the customer
                    being offered a second review of something they have already rated. */}
                {review && (
                  <div className="flex items-center gap-2 mt-1.5 min-w-0">
                    <StarRating value={review.rating} readOnly size="w-3.5 h-3.5" />
                    {review.comment ? (
                      <p className="text-xs text-gray-500 italic truncate">“{review.comment}”</p>
                    ) : (
                      <span className="text-xs text-gray-400">Your rating</span>
                    )}
                  </div>
                )}
              </div>
              <p className="shrink-0 text-sm font-bold text-brand-navy">{formatPrice(i.price * i.quantity)}</p>
            </div>
          );
        })}
        {hidden.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-2.5">
            <div className="flex -space-x-2">
              {hidden.slice(0, 4).map((i, index) => (
                <SafeImage
                  key={i.id || `${i.product_id}-more-${index}`}
                  src={i.image}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover bg-gray-100 ring-2 ring-white"
                  iconClassName="w-3 h-3"
                />
              ))}
            </div>
            <p className="text-xs font-semibold text-gray-500">
              +{hidden.length} more item{hidden.length === 1 ? '' : 's'} in this order
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-3.5 border-t border-gray-100 bg-gradient-to-r from-brand-light/80 to-transparent">
        <div className="min-w-0">
          {/* The total moves down here on a phone, where the header has no room beside the badge. */}
          <p className="sm:hidden font-display text-lg font-extrabold tracking-tight text-brand-navy">{formatPrice(order.total)}</p>
          <p className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
            <HintIcon className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            <span className="truncate">{hint.text}</span>
          </p>
        </div>

        <div className={actionsClass}>
          {canReview && (
            <button
              type="button"
              onClick={act(onReview)}
              className={`${ACTION_BTN} ${closeOut ? 'w-full sm:w-auto' : ''} border border-brand-orange/30 bg-brand-orange/5 text-brand-orange hover:bg-brand-orange/10`}
            >
              <Star className={ACTION_ICON} /> Add Review
            </button>
          )}
          {canComplete && (
            <button
              type="button"
              onClick={act(onComplete)}
              className={`${ACTION_BTN} flex-1 sm:flex-none bg-brand-teal text-white shadow-sm shadow-brand-teal/30 hover:bg-teal-600`}
            >
              <CircleCheckBig className={ACTION_ICON} /> Mark as Completed
            </button>
          )}
          {/* Icon only, at the end of the row: the other way to close out a delivery, kept quieter
              than completing. Same modal the order details open, and the name the details button
              uses goes on the label and the tooltip. The tooltip is a named group so hovering the
              card (itself a `group`) doesn't set it off. */}
          {canRefund && (
            <span className="group/refund relative shrink-0">
              <button
                type="button"
                onClick={act(onRefund)}
                aria-label="Return or Refund"
                className="grid h-9 w-9 place-items-center rounded-lg border border-gray-300 bg-white/70 text-brand-navy hover:border-brand-navy/30 hover:bg-gray-50 active:scale-[0.96] transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-md bg-brand-ink px-2 py-1 text-xs font-medium text-white opacity-0 translate-y-1 transition group-hover/refund:opacity-100 group-hover/refund:translate-y-0 group-focus-within/refund:opacity-100 group-focus-within/refund:translate-y-0"
              >
                Return or Refund
              </span>
            </span>
          )}
          {/* To Ship and To Receive orders: the same tracking map the order details open. */}
          {canTrack && (
            <button
              type="button"
              onClick={act(onTrack)}
              className={`${ACTION_BTN} bg-brand-navy text-white shadow-sm shadow-brand-navy/25 hover:bg-brand-blue`}
            >
              <Truck className={ACTION_ICON} /> Track Order
            </button>
          )}
          {status === 'returned' && (
            <button
              type="button"
              onClick={act(onViewReturn)}
              className={`${ACTION_BTN} border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100`}
            >
              View Return <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {!canReview && !canComplete && status !== 'returned' && (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-navy group-hover:text-brand-orange transition">
              View details <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderCardSkeleton() {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3.5">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="flex items-center gap-3.5">
        <Skeleton className="w-14 h-14 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completing, setCompleting] = useState(false);
  // product id -> the customer's review of it. A Map rather than a set of ids because the cards
  // show the rating back, not just whether one exists. Still answers .has(), which is all the
  // review modal asks of it.
  const [myReviews, setMyReviews] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Tab, category and search all live in the URL so a filtered view can be linked and walked
  // back to with the browser's back button; anything unrecognised falls back to All.
  const requested = searchParams.get('tab');
  const activeKey = TABS.some(t => t.key === requested) ? requested : DEFAULT_TAB;
  const activeTab = TABS.find(t => t.key === activeKey);
  const query = searchParams.get('q') || '';

  // Replaced rather than pushed: a filter is a view of the same page, and Back should leave it
  // instead of replaying every keystroke typed into the search box.
  const updateParams = (key, value, fallback = '') => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (!value || value === fallback) next.delete(key); else next.set(key, value);
      return next;
    }, { replace: true });
  };
  const selectTab = (key) => updateParams('tab', key, DEFAULT_TAB);
  const selectCategory = (key) => updateParams('category', key);
  const setQuery = (q) => updateParams('q', q);
  const resetFilters = () => setSearchParams({}, { replace: true });

  const loadOrders = () => api.get('/orders/my').then(setOrders).catch(() => {}).finally(() => setLoaded(true));
  // One review per customer per product, so the set of products already rated is what decides
  // whether a delivered order still has anything to review. Fetched once for the whole list
  // rather than per card, and refreshed after posting.
  const loadReviewed = () => api.get('/reviews/my')
    .then(rows => setMyReviews(new Map(rows.map(r => [r.product_id, r]))))
    .catch(() => setMyReviews(new Map()));
  useEffect(() => { loadOrders(); loadReviewed(); }, []);

  const reviewableCount = (order) => (order.items || [])
    .filter(i => !myReviews?.has(i.product_id))
    .length;

  // Only the categories this customer has actually bought from get a filter — offering Solar
  // Panels to someone who has only ever ordered a fan is a list of dead ends.
  const categories = useMemo(() => {
    const all = new Map();
    orders.forEach(o => categoriesOf(o).forEach(c => { if (!all.has(c.key)) all.set(c.key, c.label); }));
    return [...all.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, label]) => ({ key, label }));
  }, [orders]);

  const requestedCategory = searchParams.get('category') || ALL;
  const activeCategory = categories.some(c => c.key === requestedCategory) ? requestedCategory : ALL;
  const inCategory = (o) => activeCategory === ALL || categoriesOf(o).some(c => c.key === activeCategory);

  const terms = useMemo(() => searchTerms(query), [query]);
  const searched = useMemo(() => orders.filter(o => matchesTerms(orderHaystack(o), terms)), [orders, terms]);

  // Faceted counts: each list counts what it would show given every *other* filter in play, so
  // a number beside a status is always what clicking it will actually produce.
  const statusOptions = useMemo(() => {
    const pool = searched.filter(inCategory);
    return TABS.map(t => ({ key: t.key, label: t.label, icon: t.icon, count: pool.filter(t.match).length }));
  }, [searched, activeCategory]);

  const categoryOptions = useMemo(() => {
    const pool = searched.filter(activeTab.match);
    return [
      { key: ALL, label: 'All categories', icon: ShoppingBag, count: pool.length },
      ...categories.map(c => ({
        ...c,
        icon: getCategoryIcon(c.key),
        count: pool.filter(o => categoriesOf(o).some(oc => oc.key === c.key)).length,
      })),
    ];
  }, [searched, activeTab, categories]);

  const visible = useMemo(
    () => searched.filter(activeTab.match).filter(inCategory),
    [searched, activeTab, activeCategory],
  );
  const filtering = activeKey !== DEFAULT_TAB || activeCategory !== ALL || terms.length > 0;

  // An order that was already paid for online comes back with a refund reference: the cancel
  // itself went through either way, but the money now has to be approved and sent, so saying only
  // "cancelled" would leave the customer wondering where their payment went.
  const submitCancel = async (reason) => {
    const order = cancelTarget;
    const { refund } = await api.put(`/orders/${order.id}/cancel`, { reason });
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cancelled', cancel_reason: reason } : o));
    setSelectedOrder(prev => prev && prev.id === order.id ? { ...prev, status: 'cancelled', cancel_reason: reason } : prev);
    setCancelTarget(null);
    showToast(refund
      ? {
        icon: Banknote,
        iconClass: 'bg-amber-100 text-amber-700',
        title: 'Cancelled — refund on the way',
        description: `${refund.ref} · we’ll email you once it’s approved`,
      }
      : { icon: XCircle, iconClass: 'bg-red-100 text-red-600', title: 'Order cancelled', description: `Order #${orderRef(order)}` });
  };

  // One-way: the server closes the return window for good, so canReturn is cleared here as well
  // rather than waiting on a reload to hide the return button in the details modal.
  const submitComplete = async () => {
    if (completing) return;
    const order = completeTarget;
    setCompleting(true);
    try {
      const { completed_at } = await api.put(`/orders/${order.id}/complete`, {});
      const patch = (o) => (o && o.id === order.id ? { ...o, completed_at, canReturn: false } : o);
      setOrders(prev => prev.map(patch));
      setSelectedOrder(patch);
      showToast({
        icon: CircleCheckBig,
        iconClass: 'bg-teal-100 text-teal-700',
        title: 'Order completed',
        description: `Order #${orderRef(order)} · returns and refunds are now closed`,
      });
    } catch (err) {
      showToast({ icon: XCircle, iconClass: 'bg-red-100 text-red-600', title: 'Couldn’t complete this order', description: err.message });
    } finally {
      setCompleting(false);
      setCompleteTarget(null);
    }
  };

  const canComplete = (o) => o.status === 'delivered' && !o.returned && !o.completed_at;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/account')} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-brand-navy transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <p className="eyebrow mb-3">Order History</p>
      <h1 className="section-title mb-6">My Orders</h1>

      {!loaded ? (
        <div className="space-y-4 lg:pl-[284px]">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      ) : orders.length === 0 ? (
        <div className="card text-center px-6 py-16">
          <div className="mx-auto mb-5 grid place-items-center w-16 h-16 rounded-2xl bg-brand-orange/10 text-brand-orange">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <p className="font-display text-xl font-bold text-brand-ink">No orders yet</p>
          <p className="text-sm text-gray-500 mt-1.5">Everything you buy shows up here, from checkout to your doorstep.</p>
          <Link to="/products" className="btn-primary inline-flex items-center gap-2 mt-6">
            Browse products <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] items-start">
          <FilterSidebar
            onReset={filtering ? resetFilters : null}
            groups={[
              { key: 'status', title: 'Status', options: statusOptions, active: activeKey, onSelect: selectTab },
              { key: 'category', title: 'Category', options: categoryOptions, active: activeCategory, onSelect: selectCategory },
            ]}
          />

          <div className="min-w-0 space-y-4">
            <HistorySearch value={query} onChange={setQuery} placeholder="Search by order number, product, or brand" />

            <p className="px-1 text-xs font-medium text-gray-500">
              {visible.length === orders.length
                ? `${orders.length} order${orders.length === 1 ? '' : 's'}`
                : `Showing ${visible.length} of ${orders.length} orders`}
            </p>

            {visible.length === 0 ? (
              <div className="card text-center px-6 py-14">
                <SearchX className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {terms.length > 0 || activeCategory !== ALL
                    ? 'No orders match these filters.'
                    : activeTab.empty}
                </p>
                {filtering && (
                  <button type="button" onClick={resetFilters} className="mt-4 text-sm font-semibold text-brand-orange hover:underline">
                    Clear search and filters
                  </button>
                )}
              </div>
            ) : (
              visible.map(o => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onOpen={() => setSelectedOrder(o)}
                  reviews={myReviews}
                  canReview={o.status === 'delivered' && !o.returned && reviewableCount(o) > 0}
                  canComplete={canComplete(o)}
                  // canReturn is the server's call (delivered, inside the 7-day window, units left
                  // to send back). An order already under Returns keeps its View Return button
                  // instead — returning the rest of it still goes through the order details.
                  canRefund={!!o.canReturn && displayStatus(o) === 'delivered'}
                  // The To Ship and To Receive tabs' statuses: still on the way, so worth following.
                  canTrack={['pending', 'processing', 'shipped'].includes(o.status)}
                  onReview={() => setReviewTarget(o)}
                  onComplete={() => setCompleteTarget(o)}
                  onRefund={() => setReturnTarget(o)}
                  onTrack={() => setTrackingOrder(o)}
                  onViewReturn={() => navigate('/account?tab=returns')}
                />
              ))
            )}
          </div>
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
          onCompleteOrder={canComplete(selectedOrder) ? setCompleteTarget : undefined}
        />
      )}

      {trackingOrder && (
        <TrackingModal
          kind="order"
          id={trackingOrder.id}
          title={`Order #${orderRef(trackingOrder)}`}
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
        reviewed={myReviews}
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

      {/* Completing gives up the right to return, so the dialog says so in as many words — and,
          while the window is still open, says exactly how much time the customer is giving up. */}
      <ConfirmDialog
        open={!!completeTarget}
        icon={CircleCheckBig}
        tone="create"
        zIndexClass="z-[110]"
        title="Mark this order as completed?"
        message={completeTarget
          ? `Confirm that everything arrived and you’re keeping it. Once completed, order #${orderRef(completeTarget)} can’t be returned or refunded.${completeTarget.canReturn ? `\n\nIf you leave it open, you can still request a return until ${shortDate(returnWindowClosesAt(completeTarget))}.` : ''}`
          : ''}
        confirmLabel={completing ? 'Completing…' : 'Mark as Completed'}
        cancelLabel="Not yet"
        onConfirm={submitComplete}
        onCancel={() => { if (!completing) setCompleteTarget(null); }}
      />

      {/* What happens to the money is the one thing a customer wants to know before confirming,
          and it differs entirely by how they paid — so the copy says which of the two it is
          rather than making them find out afterwards. payment_status, not payment_method: an
          unverified bank transfer has taken nothing yet and cancels like a COD order. */}
      <CancelReasonModal
        open={!!cancelTarget}
        title="Cancel this order?"
        message={cancelTarget?.payment_status === 'paid'
          ? `This can't be undone. You've already paid ${formatPrice(cancelTarget.total)} by ${paymentMethodLabel(cancelTarget.payment_method)} — we'll review the refund and send it back to you. Let us know why you're cancelling.`
          : "This can't be undone once submitted. Nothing has been charged, so there's no refund to process. Let us know why you're cancelling."}
        onSubmit={submitCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
