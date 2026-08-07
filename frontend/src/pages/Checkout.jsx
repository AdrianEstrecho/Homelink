import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, X, Lock, ShieldCheck, Truck, Sparkles, ShoppingBag } from 'lucide-react';
import { api, formatPrice } from '../api/client';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import AddressPicker from '../components/AddressPicker';
import PaymentMethodPicker from '../components/PaymentMethodPicker';
import OrderDetailsModal from '../components/OrderDetailsModal';

function calcDiscount(amount, promo) {
  if (!promo) return 0;
  return promo.type === 'percent' ? Math.round(amount * promo.value / 100 * 100) / 100 : Math.min(promo.value, amount);
}

export default function Checkout() {
  const { items, total: subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const addressRef = useRef(null);
  const paymentRef = useRef(null);

  const [activePromos, setActivePromos] = useState(null);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);

  const [error, setError] = useState('');
  const [pendingOrder, setPendingOrder] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  useEffect(() => {
    api.get('/promos/active').then(setActivePromos).catch(() => setActivePromos({ holiday: null, vouchers: [] }));
  }, []);

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setApplyingPromo(true);
    setPromoError('');
    try {
      const res = await api.post('/promos/validate-voucher', { code: promoInput.trim(), amount: subtotal });
      setAppliedPromo({ code: promoInput.trim().toUpperCase(), type: res.discountType, value: res.discountValue });
      setPromoInput('');
    } catch (err) {
      setPromoError(err.message);
    } finally {
      setApplyingPromo(false);
    }
  };

  const removePromo = () => { setAppliedPromo(null); setPromoError(''); };

  const holidayPromo = activePromos?.holiday || null;
  const holidayAmt = calcDiscount(subtotal, holidayPromo);
  const voucherAmt = appliedPromo ? calcDiscount(subtotal - holidayAmt, appliedPromo) : 0;
  const orderTotal = Math.max(0, subtotal - holidayAmt - voucherAmt);

  // Step 1: build a receipt preview from what's already validated on the client — nothing is
  // sent to the server yet, so nothing is charged, no stock moves, and no email goes out.
  const handleReview = (e) => {
    e.preventDefault();
    const selectedAddress = addressRef.current?.validate();
    if (!selectedAddress) { setError('Please select or add a shipping address.'); return; }
    const payment = paymentRef.current?.validate();
    if (!payment) return;

    setError('');
    setPendingOrder({
      items: items.map(i => ({ id: i.productId, name: i.name, image: i.image, price: i.price, quantity: i.quantity })),
      shipping_address: selectedAddress.fullAddress,
      payment_method: payment.method,
      promo_code: appliedPromo?.code || null,
      subtotal,
      discount: holidayAmt + voucherAmt,
      total: orderTotal,
    });
  };

  // Step 2: only now does the order actually get placed — this is the one call that creates
  // the order row, deducts stock, and triggers the confirmation email.
  const handleConfirmOrder = async () => {
    setPlacingOrder(true);
    setError('');
    try {
      const order = await api.post('/orders', {
        items: pendingOrder.items.map(i => ({ productId: i.id, quantity: i.quantity })),
        shippingAddress: pendingOrder.shipping_address,
        paymentMethod: pendingOrder.payment_method,
        promoCode: pendingOrder.promo_code || undefined,
      });
      clearCart();
      setPendingOrder(null);
      setConfirmedOrder(order);
    } catch (err) {
      setError(err.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  // Show the receipt — with its own confirmation banner — before sending the customer
  // anywhere else. Checked ahead of the empty-cart guard below, since clearCart() just ran
  // and would otherwise make that guard hijack this render with "your cart is empty".
  if (confirmedOrder) {
    return (
      <OrderDetailsModal
        order={confirmedOrder}
        justConfirmed
        person={user ? { name: `${user.firstName} ${user.lastName}`, email: user.email } : null}
        personLabel="Billed To"
        onClose={() => navigate('/orders')}
      />
    );
  }

  // Step in between: the reviewable receipt with the "Confirm & Place Order" button. Sits
  // above the empty-cart guard too, since the cart still holds items at this point anyway.
  if (pendingOrder) {
    return (
      <OrderDetailsModal
        order={pendingOrder}
        previewing
        confirmLoading={placingOrder}
        onConfirm={handleConfirmOrder}
        error={error}
        person={user ? { name: `${user.firstName} ${user.lastName}`, email: user.email } : null}
        personLabel="Billed To"
        onClose={() => { setPendingOrder(null); setError(''); }}
      />
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-bold text-brand-ink mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-6">Add some products before checking out.</p>
        <Link to="/products" className="btn-primary">Browse Products</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14">
      <p className="eyebrow mb-3">Final Step</p>
      <h1 className="section-title mb-8">Checkout</h1>

      <form onSubmit={handleReview} className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
        <div className="space-y-6">
          <section className="card p-6">
            <AddressPicker ref={addressRef} stepNumber={1} title="Shipping Address" />
          </section>

          <section className="card p-6">
            <PaymentMethodPicker ref={paymentRef} stepNumber={2} />
          </section>

          <section className="card p-6">
            <h2 className="flex items-center gap-2.5 text-sm font-semibold text-brand-ink mb-5">
              <span className="w-6 h-6 rounded-full bg-brand-navy text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
              Promo Code
            </h2>
            {holidayPromo && (
              <p className="flex items-center gap-1.5 text-sm text-brand-teal font-medium mb-4">
                <Sparkles className="w-4 h-4" /> {holidayPromo.label} automatically applied
              </p>
            )}
            {appliedPromo ? (
              <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-green-50 border border-green-200">
                <span className="flex items-center gap-2 text-sm font-semibold text-green-700"><Check className="w-4 h-4" /> {appliedPromo.code} applied</span>
                <button type="button" onClick={removePromo} className="text-green-700 hover:text-green-900"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                  placeholder="e.g. HOMELINK10"
                  className="input-field flex-1"
                />
                <button type="button" onClick={handleApplyPromo} disabled={applyingPromo || !promoInput.trim()} className="btn-secondary px-5 text-sm disabled:opacity-50">
                  {applyingPromo ? 'Checking...' : 'Apply'}
                </button>
              </div>
            )}
            {promoError && <p className="text-red-600 text-sm mt-2">{promoError}</p>}
            {!appliedPromo && <p className="text-xs text-gray-400 mt-2">Try: HOMELINK10, SAVE500, NEWHOME20</p>}
          </section>

          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        <div className="lg:sticky lg:top-24">
          <div className="card p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 mb-4">Order Summary</h2>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1 -mr-1 mb-4">
              {items.map(i => (
                <div key={i.productId} className="flex items-center gap-3">
                  <img src={i.image} alt={i.name} className="w-12 h-12 rounded-lg object-cover shrink-0 bg-gray-100" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-brand-ink truncate">{i.name}</p>
                    <p className="text-xs text-gray-400">Qty {i.quantity}</p>
                  </div>
                  <span className="text-sm font-semibold text-brand-ink shrink-0">{formatPrice(i.price * i.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm border-t border-gray-100 pt-4">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
              {holidayAmt > 0 && (
                <div className="flex justify-between text-green-600"><span>{holidayPromo.label}</span><span>-{formatPrice(holidayAmt)}</span></div>
              )}
              {voucherAmt > 0 && (
                <div className="flex justify-between text-green-600"><span>Promo ({appliedPromo.code})</span><span>-{formatPrice(voucherAmt)}</span></div>
              )}
            </div>

            <div className="flex justify-between items-center font-bold text-lg mt-3 pt-3 border-t border-gray-200">
              <span className="text-brand-ink">Total</span>
              <span className="text-brand-navy">{formatPrice(orderTotal)}</span>
            </div>

            <button type="submit" className="btn-primary w-full py-3 mt-5">
              Place Order — {formatPrice(orderTotal)}
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">Payments are processed securely. We never store your card details.</p>

            <div className="grid grid-cols-3 gap-2 mt-5 pt-5 border-t border-gray-100 text-center">
              <div>
                <Lock className="w-4 h-4 text-brand-teal mx-auto mb-1" />
                <p className="text-[11px] text-gray-400 leading-tight">Secure Checkout</p>
              </div>
              <div>
                <ShieldCheck className="w-4 h-4 text-brand-teal mx-auto mb-1" />
                <p className="text-[11px] text-gray-400 leading-tight">Buyer Protection</p>
              </div>
              <div>
                <Truck className="w-4 h-4 text-brand-teal mx-auto mb-1" />
                <p className="text-[11px] text-gray-400 leading-tight">Fast Delivery</p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
