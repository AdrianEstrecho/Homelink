import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Loader2, XCircle } from 'lucide-react';
import { api } from '../api/client';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import OrderDetailsModal from '../components/OrderDetailsModal';

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 30;

// PayMongo lands the browser back here after a GCash or 3D-Secure card redirect. The actual
// payment confirmation is driven by PayMongo's webhook on the backend — this page just polls
// /payments/status until that's landed (or a bounded number of attempts pass), then reuses
// the existing order confirmation UI.
export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const pendingCheckoutId = searchParams.get('pcid');
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const { user } = useAuth();

  const [state, setState] = useState('processing'); // 'processing' | 'succeeded' | 'failed' | 'timeout'
  const [order, setOrder] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const attemptsRef = useRef(0);
  const clearedRef = useRef(false);

  useEffect(() => {
    if (!pendingCheckoutId) { setState('failed'); return; }

    let cancelled = false;
    const poll = async () => {
      try {
        const result = await api.get(`/payments/status/${pendingCheckoutId}`);
        if (cancelled) return;

        if (result.status === 'succeeded') {
          if (!clearedRef.current) { clearCart(); clearedRef.current = true; }
          setOrder(result.order);
          setState('succeeded');
          return;
        }
        if (result.status === 'failed') {
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
  }, [pendingCheckoutId, clearCart]);

  if (state === 'succeeded' && order) {
    return (
      <OrderDetailsModal
        order={order}
        justConfirmed
        person={user ? { name: `${user.firstName} ${user.lastName}`, email: user.email } : null}
        personLabel="Billed To"
        onClose={() => navigate('/orders')}
      />
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      {state === 'processing' && (
        <>
          <Loader2 className="w-12 h-12 text-brand-teal mx-auto mb-4 animate-spin" />
          <h2 className="font-display text-xl font-bold text-brand-ink mb-2">Confirming your payment…</h2>
          <p className="text-gray-500">This usually only takes a few seconds. Please don't close this page.</p>
        </>
      )}

      {state === 'failed' && (
        <>
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-brand-ink mb-2">Payment didn't go through</h2>
          <p className="text-gray-500 mb-6">{errorMsg || "We couldn't confirm this payment. Your cart is still saved — you can try again."}</p>
          <Link to="/checkout" className="btn-primary">Back to Checkout</Link>
        </>
      )}

      {state === 'timeout' && (
        <>
          <Loader2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-brand-ink mb-2">Taking longer than expected</h2>
          <p className="text-gray-500 mb-6">We'll email you a confirmation once it's through, or you can check your order history in a moment.</p>
          <Link to="/orders" className="btn-primary">View Order History</Link>
        </>
      )}
    </div>
  );
}
