import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Loader2, XCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { startBookingPayment } from '../utils/bookingCheckout';

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 30;
const BOOKING_QUEUE_KEY = 'homelink_booking_queue';

// PayMongo lands the browser back here after paying on its hosted Checkout Session page
// (card, GCash, or QR Ph). The actual payment confirmation is driven by PayMongo's webhook on
// the backend — this page just polls /bookings/status until that's landed. If ServiceBook
// queued extra services (every method always redirects out, one payment at a time), this
// continues the queue by kicking off the next one until it's empty.
export default function BookingReturn() {
  const [searchParams] = useSearchParams();
  const pendingBookingId = searchParams.get('pbid');
  const navigate = useNavigate();

  const [state, setState] = useState('processing'); // 'processing' | 'chaining' | 'succeeded' | 'failed' | 'timeout'
  const [booking, setBooking] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!pendingBookingId) { setState('failed'); return; }

    let cancelled = false;
    const poll = async () => {
      try {
        const result = await api.get(`/bookings/status/${pendingBookingId}`);
        if (cancelled) return;

        if (result.status === 'succeeded') {
          const queueRaw = sessionStorage.getItem(BOOKING_QUEUE_KEY);
          const queue = queueRaw ? JSON.parse(queueRaw) : null;
          if (queue?.remaining?.length) {
            const [next, ...rest] = queue.remaining;
            sessionStorage.setItem(BOOKING_QUEUE_KEY, JSON.stringify({ ...queue, remaining: rest }));
            setState('chaining');
            await startBookingPayment({ ...next, paymentMethod: queue.paymentMethod });
            return; // navigates away to the next payment authorization
          }
          sessionStorage.removeItem(BOOKING_QUEUE_KEY);
          setBooking(result.booking);
          setState('succeeded');
          return;
        }
        if (result.status === 'failed') {
          sessionStorage.removeItem(BOOKING_QUEUE_KEY);
          setErrorMsg(result.error || '');
          setState('failed');
          return;
        }

        attemptsRef.current += 1;
        if (attemptsRef.current >= MAX_ATTEMPTS) { setState('timeout'); return; }
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) setState('failed');
      }
    };

    poll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBookingId]);

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      {(state === 'processing' || state === 'chaining') && (
        <>
          <Loader2 className="w-12 h-12 text-brand-teal mx-auto mb-4 animate-spin" />
          <h2 className="font-display text-xl font-bold text-brand-ink mb-2">
            {state === 'chaining' ? 'Continuing to your next service…' : 'Confirming your payment…'}
          </h2>
          <p className="text-gray-500">This usually only takes a few seconds. Please don't close this page.</p>
        </>
      )}

      {state === 'succeeded' && (
        <>
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-brand-ink mb-2">Booking confirmed!</h2>
          <p className="text-gray-500 mb-6">
            {booking?.service_name ? `${booking.service_name} is booked for ${booking.scheduled_date}.` : 'Your service has been booked.'}
          </p>
          <button onClick={() => navigate('/bookings')} className="btn-primary">View My Bookings</button>
        </>
      )}

      {state === 'failed' && (
        <>
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-brand-ink mb-2">Payment didn't go through</h2>
          <p className="text-gray-500 mb-6">{errorMsg || "We couldn't confirm this payment. You can try booking again."}</p>
          <Link to="/services" className="btn-primary">Back to Services</Link>
        </>
      )}

      {state === 'timeout' && (
        <>
          <Loader2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-brand-ink mb-2">Taking longer than expected</h2>
          <p className="text-gray-500 mb-6">We'll email you a confirmation once it's through, or you can check your bookings in a moment.</p>
          <Link to="/bookings" className="btn-primary">View My Bookings</Link>
        </>
      )}
    </div>
  );
}
