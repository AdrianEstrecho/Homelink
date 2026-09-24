import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, Truck, XCircle } from 'lucide-react';
import { api, formatPrice, statusColor } from '../api/client';
import { getServiceCategoryIcon } from '../constants/serviceCategoryIcons';
import { useToast } from '../context/ToastContext';
import CancelReasonModal from '../components/CancelReasonModal';
import TrackingModal from '../components/TrackingModal';
import BookingDetailsModal from '../components/BookingDetailsModal';
import Pagination from '../components/Pagination';

// Booking cards are tall — service, schedule, address, technician, price, and sometimes a
// cancellation reason — so five of them is about one screenful. Past that the list pages
// rather than growing, the same bargain the admin lists make.
const PAGE_SIZE = 5;

// service_category comes from services.category via /bookings/my, but a booking whose service
// lost its category shouldn't vanish from every tab, so it files under one of its own.
const categoryOf = (b) => b.service_category || 'Other';

const ALL = '';

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

  // Only the categories this customer has actually booked get a tab — a filter row offering
  // Plumbing to someone who has only ever booked an aircon clean is a row of dead ends.
  const categories = useMemo(() => {
    const counts = new Map();
    bookings.forEach(b => {
      const key = categoryOf(b);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, count]) => ({ category, count }));
  }, [bookings]);

  // Category and page both live in the URL, the same way the catalog carries its filters, so a
  // filtered view can be linked and walked back to with the browser's back button. A category
  // the customer has no bookings in falls back to All — which also covers the first render,
  // before /bookings/my has answered.
  const requested = searchParams.get('category') || ALL;
  const activeCategory = categories.some(c => c.category === requested) ? requested : ALL;
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

  // Switching category starts over: page 3 of everything is an offset one category may not
  // even reach, which would land the reader on an empty list.
  const selectCategory = (category) => {
    const next = new URLSearchParams(searchParams);
    if (category === ALL) next.delete('category');
    else next.set('category', category);
    next.delete('page');
    setSearchParams(next);
  };

  const visible = useMemo(
    () => (activeCategory === ALL ? bookings : bookings.filter(b => categoryOf(b) === activeCategory)),
    [bookings, activeCategory],
  );

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/account')} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-brand-navy transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <p className="eyebrow mb-3">Schedule</p>
      <h1 className="section-title mb-6">My Service Bookings</h1>

      {/* Same underline tabs and count badges as the orders history, so the two pages a customer
          reaches from their account read as one pair. Scrolls sideways on a phone. Shown from the
          first booking on, like the orders tabs — with one category it reads as a count rather
          than a choice, which is still worth saying. */}
      {bookings.length > 0 && (
        <div className="flex gap-6 sm:gap-8 border-b border-gray-200 overflow-x-auto no-scrollbar mb-6">
          {[{ category: ALL, count: bookings.length, label: 'All', icon: LayoutGrid }, ...categories].map(c => {
            const active = c.category === activeCategory;
            const Icon = c.icon || getServiceCategoryIcon(c.category);
            return (
              <button
                key={c.category || 'all'}
                onClick={() => selectCategory(c.category)}
                aria-pressed={active}
                className={`flex items-center gap-2 pb-4 text-sm font-semibold transition border-b-2 -mb-px whitespace-nowrap ${active ? 'border-brand-orange text-brand-navy' : 'border-transparent text-gray-400 hover:text-brand-navy'}`}
              >
                <Icon className="w-4 h-4" />
                {c.label || c.category}
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none transition-colors ${active ? 'bg-brand-orange/10 text-brand-orange' : 'bg-gray-100 text-gray-500'}`}>
                  {c.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* A tab only exists for a category this customer has booked, so a filter can never empty
          the list — an empty list here means they have never booked anything. */}
      {visible.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No bookings yet.</p>
      ) : (
        <>
          <div className="space-y-4">
            {paginated.map(b => (
              <div
                key={b.id}
                onClick={() => setSelectedBooking(b)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBooking(b); } }}
                className="card p-6 cursor-pointer hover:border-brand-navy/20 hover:shadow-md transition"
              >
                <div className="flex flex-wrap justify-between items-start gap-2 mb-4 pb-4 border-b border-gray-100">
                  <div>
                    <h3 className="font-display font-bold text-brand-ink">{b.service_name}</h3>
                    <p className="text-sm text-gray-500">{b.service_category}</p>
                  </div>
                  <span className={`badge ${statusColor(b.status)}`}>{b.status.replace('_', ' ')}</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1 mb-4">
                  <p>Date: {b.scheduled_date} at {b.scheduled_time}</p>
                  <p>Address: {b.address}</p>
                  {b.employee_first_name && <p>Technician: {b.employee_first_name} {b.employee_last_name}</p>}
                </div>
                {b.status === 'cancelled' && b.cancel_reason && (
                  <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4">
                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Cancellation Reason</p>
                    <p className="text-sm text-red-800">{b.cancel_reason}</p>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-bold text-brand-navy">{formatPrice(b.price)}</span>
                  <div className="flex items-center gap-4">
                    {b.status !== 'cancelled' && (
                      <button onClick={(e) => { e.stopPropagation(); setTrackingBooking(b); }} className="flex items-center gap-1.5 text-sm text-brand-teal hover:underline">
                        <Truck className="w-4 h-4" /> Track
                      </button>
                    )}
                    {b.status === 'pending' && (
                      <button onClick={(e) => { e.stopPropagation(); setCancelTarget(b); }} className="text-sm text-red-600 hover:underline">Cancel</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6">
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
