import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, LayoutGrid, Truck, XCircle, Hourglass, CalendarCheck, Wrench, CircleCheckBig,
  CalendarClock, CalendarPlus, Clock, MapPin, UserRound, ChevronRight, SearchX,
} from 'lucide-react';
import { api, formatPrice, statusColor } from '../api/client';
import { getServiceCategoryIcon } from '../constants/serviceCategoryIcons';
import { paymentMethodLabel } from '../constants/paymentMethods';
import { useToast } from '../context/ToastContext';
import CancelReasonModal from '../components/CancelReasonModal';
import TrackingModal from '../components/TrackingModal';
import BookingDetailsModal from '../components/BookingDetailsModal';
import Pagination from '../components/Pagination';
import { Skeleton } from '../components/Skeleton';
import { FilterSidebar, HistorySearch, searchTerms, matchesTerms } from '../components/history/HistoryFilters';

// Booking cards are tall — schedule, service, address, technician, price, and sometimes a
// cancellation reason — so five of them is about one screenful. Past that the list pages
// rather than growing, the same bargain the admin lists make.
const PAGE_SIZE = 5;

// service_category comes from services.category via /bookings/my, but a booking whose service
// lost its category shouldn't vanish from every filter, so it files under one of its own.
const categoryOf = (b) => b.service_category || 'Other';
const bookingRef = (b) => b.id.slice(0, 8).toUpperCase();

const ALL = '';
const ALL_STATUSES = 'all';

// The statuses a booking actually moves through (bookings.status in backend/db/database.js).
const STATUSES = [
  { key: ALL_STATUSES, label: 'All bookings', icon: LayoutGrid, empty: 'No bookings yet.' },
  { key: 'pending', label: 'Pending', icon: Hourglass, empty: 'No bookings waiting on confirmation.' },
  { key: 'confirmed', label: 'Confirmed', icon: CalendarCheck, empty: 'No confirmed visits coming up.' },
  { key: 'in_progress', label: 'In Progress', icon: Wrench, empty: 'No jobs underway right now.' },
  { key: 'completed', label: 'Completed', icon: CircleCheckBig, empty: 'No completed services yet.' },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle, empty: 'No cancelled bookings.' },
];
const STATUS_LABEL = Object.fromEntries(STATUSES.map(s => [s.key, s.label]));
const matchesStatus = (key) => (b) => key === ALL_STATUSES || b.status === key;

// The date stub's colour, so a column of tickets reads by state before a word of it is: navy for
// a visit still ahead, indigo while the technician is on site, teal once done, grey if called
// off. Whole class strings, because Tailwind never sees one assembled at runtime.
const STUB_TONE = {
  pending: 'from-brand-navy to-brand-blue',
  confirmed: 'from-brand-navy to-brand-blue',
  in_progress: 'from-indigo-600 to-brand-blue',
  completed: 'from-brand-teal to-teal-700',
  cancelled: 'from-gray-400 to-gray-500',
};

// scheduled_date is a bare 'YYYY-MM-DD'. new Date() on that alone reads it as UTC midnight,
// which is the previous evening anywhere west of Greenwich — pinning a local time keeps the day.
const parseDay = (s) => {
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// '14:00' -> '2:00 PM', in the reader's own clock convention.
const formatTime = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  if (Number.isNaN(h)) return t;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

// How soon a visit still ahead of the customer is, for the small countdown beside the badge.
// Nothing for past dates or anything further out than two weeks — "In 40 days" is just noise.
const countdown = (b, day) => {
  if (!day || (b.status !== 'pending' && b.status !== 'confirmed')) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((day - today) / 86400000);
  if (days < 0 || days > 14) return null;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
};

const technicianOf = (b) => (b.employee_first_name ? `${b.employee_first_name} ${b.employee_last_name || ''}`.trim() : null);

// What a customer might type to find a visit again: the service, where, who, and the reference.
const bookingHaystack = (b) => [
  b.service_name, categoryOf(b), b.address, technicianOf(b), bookingRef(b), STATUS_LABEL[b.status], paymentMethodLabel(b.payment_method),
];

// A booking is an appointment, so it's drawn as one: a tear-off date stub on the left (on top on
// a phone) and the job itself beside it. The notches are page-coloured circles half-hidden by
// the card's overflow, which is what cuts the bite out of the edge.
function BookingCard({ booking: b, onOpen, onTrack, onCancel }) {
  const day = parseDay(b.scheduled_date);
  const CategoryIcon = getServiceCategoryIcon(b.service_category);
  const soon = countdown(b, day);
  const technician = technicianOf(b);
  const cancelled = b.status === 'cancelled';
  const act = (fn) => (e) => { e.stopPropagation(); fn(); };

  // A div rather than a button, because the card carries its own action buttons and a button
  // inside a button is neither valid nor reachable by keyboard.
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); } }}
      aria-label={`${b.service_name}, ${b.scheduled_date} at ${formatTime(b.scheduled_time)}, ${STATUS_LABEL[b.status] || b.status}`}
      className="card group flex flex-col sm:flex-row cursor-pointer hover:border-brand-navy/15 hover:shadow-[0_14px_40px_-14px_rgba(15,43,91,0.28)] hover:-translate-y-0.5"
    >
      <div className={`relative shrink-0 sm:w-36 bg-gradient-to-br ${STUB_TONE[b.status] || STUB_TONE.pending} text-white px-5 py-4 sm:py-6 flex sm:flex-col items-center justify-between sm:justify-center gap-3`}>
        {day ? (
          <div className={`flex sm:flex-col items-baseline sm:items-center gap-2 sm:gap-0.5 text-center ${cancelled ? 'opacity-80' : ''}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
              {day.toLocaleDateString(undefined, { month: 'short' })}
            </p>
            <p className={`font-display text-3xl sm:text-5xl font-extrabold leading-none tracking-tight ${cancelled ? 'line-through decoration-2 decoration-white/60' : ''}`}>
              {day.getDate()}
            </p>
            <p className="text-xs font-semibold text-white/75">
              {day.toLocaleDateString(undefined, { weekday: 'short' })} {day.getFullYear() !== new Date().getFullYear() && day.getFullYear()}
            </p>
          </div>
        ) : (
          <p className="text-sm font-semibold">{b.scheduled_date}</p>
        )}
        <p className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold tabular-nums sm:mt-2">
          <Clock className="w-3 h-3" /> {formatTime(b.scheduled_time)}
        </p>

        {/* Tear line and notches — along the bottom edge on a phone, the right edge from sm up. */}
        <span aria-hidden className="absolute inset-x-5 bottom-0 border-b-2 border-dashed border-white/30 sm:hidden" />
        <span aria-hidden className="absolute -left-2.5 -bottom-2.5 h-5 w-5 rounded-full bg-white sm:hidden" />
        <span aria-hidden className="absolute -right-2.5 -bottom-2.5 h-5 w-5 rounded-full bg-white sm:hidden" />
        <span aria-hidden className="hidden sm:block absolute right-0 inset-y-5 border-r-2 border-dashed border-white/30" />
        <span aria-hidden className="hidden sm:block absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full bg-white" />
        <span aria-hidden className="hidden sm:block absolute -right-2.5 -bottom-2.5 h-5 w-5 rounded-full bg-white" />
      </div>

      <div className="flex-1 min-w-0 p-5 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-teal">
              <CategoryIcon className="w-3.5 h-3.5" /> {categoryOf(b)}
            </p>
            <h3 className="font-display text-lg font-bold leading-snug tracking-tight text-brand-ink mt-1 line-clamp-2">{b.service_name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Booking <span className="font-mono">#{bookingRef(b)}</span></p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`badge ${statusColor(b.status)}`}>{STATUS_LABEL[b.status] || b.status}</span>
            {soon && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/10 px-2 py-0.5 text-[11px] font-bold text-brand-orange">
                <CalendarClock className="w-3 h-3" /> {soon}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 text-sm text-gray-600">
          <p className="flex items-start gap-2 min-w-0">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
            <span className="line-clamp-2">{b.address}</span>
          </p>
          {(technician || !cancelled) && (
            <p className="flex items-start gap-2 min-w-0">
              <UserRound className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
              {technician
                ? <span className="truncate">{technician}</span>
                : <span className="text-gray-400">Technician not yet assigned</span>}
            </p>
          )}
        </div>

        {cancelled && b.cancel_reason && (
          <div className="mt-4 bg-red-50/80 border border-red-100 rounded-xl px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide mb-0.5">Cancellation reason</p>
            <p className="text-sm text-red-800 line-clamp-2">{b.cancel_reason}</p>
          </div>
        )}

        {b.status === 'completed' && b.completion_notes && (
          <div className="mt-4 bg-teal-50/80 border border-teal-100 rounded-xl px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide mb-0.5">Technician’s note</p>
            <p className="text-sm text-teal-900 line-clamp-2">{b.completion_notes}</p>
          </div>
        )}

        <div className="mt-auto pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-gray-100 pt-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                Total{b.payment_method && ` · ${paymentMethodLabel(b.payment_method)}`}
              </p>
              <p className="font-display text-xl font-extrabold tracking-tight text-brand-navy">{formatPrice(b.price)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {!cancelled && (
                <button
                  type="button"
                  onClick={act(onTrack)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-teal/30 bg-brand-teal/5 px-3.5 py-2 text-sm font-semibold text-brand-teal hover:bg-brand-teal/10 active:scale-[0.98] transition"
                >
                  <Truck className="w-4 h-4" /> Track
                </button>
              )}
              {b.status === 'pending' && (
                <button
                  type="button"
                  onClick={act(onCancel)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 active:scale-[0.98] transition"
                >
                  Cancel
                </button>
              )}
              {cancelled && (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-navy group-hover:text-brand-orange transition">
                  View details <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingCardSkeleton() {
  return (
    <div className="card flex flex-col sm:flex-row">
      <Skeleton className="h-20 sm:h-auto sm:w-36 rounded-none" />
      <div className="flex-1 p-5 space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-8 w-40 mt-4" />
      </div>
    </div>
  );
}

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [trackingBooking, setTrackingBooking] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    api.get('/bookings/my').then(setBookings).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  // Only the categories this customer has actually booked get a filter — offering Plumbing to
  // someone who has only ever booked an aircon clean is a list of dead ends.
  const categories = useMemo(
    () => [...new Set(bookings.map(categoryOf))].sort((a, b) => a.localeCompare(b)),
    [bookings],
  );

  // Status, category, search and page all live in the URL, the same way the catalog carries its
  // filters, so a filtered view can be linked and walked back to with the browser's back button.
  // A category the customer has no bookings in falls back to All — which also covers the first
  // render, before /bookings/my has answered.
  const requestedStatus = searchParams.get('status');
  const activeStatus = STATUSES.some(s => s.key === requestedStatus) ? requestedStatus : ALL_STATUSES;
  const requestedCategory = searchParams.get('category') || ALL;
  const activeCategory = categories.includes(requestedCategory) ? requestedCategory : ALL;
  const query = searchParams.get('q') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  // Page 1 is the bare URL rather than ?page=1, so a link to the top of the list looks the same
  // whether the reader ever paged or not.
  const setPage = useCallback((next, { replace = false } = {}) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (next <= 1) p.delete('page'); else p.set('page', String(next));
      return p;
    }, { replace });
  }, [setSearchParams]);

  // Changing any filter starts over: page 3 of everything is an offset one category may not
  // even reach, which would land the reader on an empty list. Search replaces rather than
  // pushes, so Back leaves the page instead of replaying every keystroke.
  const updateFilter = (key, value, fallback, { replace = false } = {}) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (!value || value === fallback) p.delete(key); else p.set(key, value);
      p.delete('page');
      return p;
    }, { replace });
  };
  const selectStatus = (key) => updateFilter('status', key, ALL_STATUSES);
  const selectCategory = (key) => updateFilter('category', key, ALL);
  const setQuery = (q) => updateFilter('q', q, '', { replace: true });
  const resetFilters = () => setSearchParams({});

  const terms = useMemo(() => searchTerms(query), [query]);
  const searched = useMemo(() => bookings.filter(b => matchesTerms(bookingHaystack(b), terms)), [bookings, terms]);
  const inCategory = (b) => activeCategory === ALL || categoryOf(b) === activeCategory;

  // Faceted counts: each list counts what it would show given every *other* filter in play.
  const statusOptions = useMemo(() => {
    const pool = searched.filter(inCategory);
    return STATUSES.map(s => ({ key: s.key, label: s.label, icon: s.icon, count: pool.filter(matchesStatus(s.key)).length }));
  }, [searched, activeCategory]);

  const categoryOptions = useMemo(() => {
    const pool = searched.filter(matchesStatus(activeStatus));
    return [
      { key: ALL, label: 'All categories', icon: LayoutGrid, count: pool.length },
      ...categories.map(c => ({
        key: c,
        label: c,
        icon: getServiceCategoryIcon(c),
        count: pool.filter(b => categoryOf(b) === c).length,
      })),
    ];
  }, [searched, activeStatus, categories]);

  const visible = useMemo(
    () => searched.filter(matchesStatus(activeStatus)).filter(inCategory),
    [searched, activeStatus, activeCategory],
  );
  const filtering = activeStatus !== ALL_STATUSES || activeCategory !== ALL || terms.length > 0;

  // A customer's own bookings are few enough to page in the browser — unlike the catalog,
  // /bookings/my hands over the whole list in one request and always has.
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const paginated = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // A bookmarked or hand-edited ?page= can point past the end of the list; fall back to the
  // last real page rather than an empty column. Waits for the list, or a deep link would be
  // clamped away against the empty one it renders against first. Replaced, not pushed, so
  // Back still leaves the page.
  useEffect(() => {
    if (loaded && page > totalPages) setPage(totalPages, { replace: true });
  }, [loaded, page, totalPages, setPage]);

  const handlePageChange = (next) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitCancel = async (reason) => {
    const booking = cancelTarget;
    await api.put(`/bookings/${booking.id}/cancel`, { reason });
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'cancelled', cancel_reason: reason } : b));
    setSelectedBooking(prev => prev && prev.id === booking.id ? { ...prev, status: 'cancelled', cancel_reason: reason } : prev);
    setCancelTarget(null);
    showToast({ icon: XCircle, iconClass: 'bg-red-100 text-red-600', title: 'Booking cancelled', description: booking.service_name });
  };

  const activeStatusMeta = STATUSES.find(s => s.key === activeStatus);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/account')} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-brand-navy transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <p className="eyebrow mb-3">Schedule</p>
      <h1 className="section-title mb-6">My Service Bookings</h1>

      {!loaded ? (
        <div className="space-y-4 lg:pl-[284px]">
          <BookingCardSkeleton />
          <BookingCardSkeleton />
        </div>
      ) : bookings.length === 0 ? (
        <div className="card text-center px-6 py-16">
          <div className="mx-auto mb-5 grid place-items-center w-16 h-16 rounded-2xl bg-brand-teal/10 text-brand-teal">
            <CalendarPlus className="w-8 h-8" />
          </div>
          <p className="font-display text-xl font-bold text-brand-ink">No bookings yet</p>
          <p className="text-sm text-gray-500 mt-1.5">Book an installation, repair, or cleaning and it’ll be scheduled here.</p>
          <Link to="/services" className="btn-primary inline-flex items-center gap-2 mt-6">
            Browse services <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] items-start">
          <FilterSidebar
            onReset={filtering ? resetFilters : null}
            groups={[
              { key: 'status', title: 'Status', options: statusOptions, active: activeStatus, onSelect: selectStatus },
              { key: 'category', title: 'Category', options: categoryOptions, active: activeCategory, onSelect: selectCategory },
            ]}
          />

          <div className="min-w-0 space-y-4">
            <HistorySearch value={query} onChange={setQuery} placeholder="Search by service, address, technician, or booking number" />

            <p className="px-1 text-xs font-medium text-gray-500">
              {visible.length === bookings.length
                ? `${bookings.length} booking${bookings.length === 1 ? '' : 's'}`
                : `Showing ${visible.length} of ${bookings.length} bookings`}
            </p>

            {visible.length === 0 ? (
              <div className="card text-center px-6 py-14">
                <SearchX className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {terms.length > 0 || activeCategory !== ALL ? 'No bookings match these filters.' : activeStatusMeta.empty}
                </p>
                {filtering && (
                  <button type="button" onClick={resetFilters} className="mt-4 text-sm font-semibold text-brand-orange hover:underline">
                    Clear search and filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {paginated.map(b => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onOpen={() => setSelectedBooking(b)}
                    onTrack={() => setTrackingBooking(b)}
                    onCancel={() => setCancelTarget(b)}
                  />
                ))}
                <div className="pt-2">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    total={visible.length}
                    pageSize={PAGE_SIZE}
                    onChange={handlePageChange}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onCancelBooking={setCancelTarget}
          onTrackBooking={setTrackingBooking}
        />
      )}

      <CancelReasonModal
        open={!!cancelTarget}
        title="Cancel this booking?"
        message="This can't be undone once submitted. Let us know why you're cancelling."
        onSubmit={submitCancel}
        onCancel={() => setCancelTarget(null)}
      />

      {trackingBooking && (
        <TrackingModal
          kind="booking"
          id={trackingBooking.id}
          title={trackingBooking.service_name}
          onClose={() => setTrackingBooking(null)}
        />
      )}
    </div>
  );
}
