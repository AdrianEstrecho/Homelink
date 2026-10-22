import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Check, X, Lock, ShieldCheck, Truck, Sparkles, ShoppingBag, ArrowLeft, Loader2 } from 'lucide-react';
import { api, formatPrice } from '../api/client';
import { canChargeCardsInline, createCardPaymentMethod } from '../api/paymongo';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { orderCharges } from '../utils/orderCharges';
import AddressPicker from '../components/AddressPicker';
import PaymentMethodPicker from '../components/PaymentMethodPicker';
import OrderDetailsModal from '../components/OrderDetailsModal';
import { isOfflinePayment } from '../constants/paymentMethods';

function calcDiscount(amount, promo) {
  if (!promo) return 0;
  return promo.type === 'percent' ? Math.round(amount * promo.value / 100 * 100) / 100 : Math.min(promo.value, amount);
}

export default function Checkout() {
  const cart = useCart();
  const { refresh: refreshWishlist } = useWishlist();
  const { user } = useAuth();
  const settings = useSiteSettings();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const addressRef = useRef(null);
  const paymentRef = useRef(null);
  // A newly entered card, held between the review and "Confirm & place order" — a ref rather
  // than state so the card number never ends up in the receipt preview's order object.
  const cardRef = useRef(null);

  // "Buy Now" from a product page lands here as ?buy=<slug>&qty=<n>: only that product is
  // ordered, and the cart is left exactly as it was. It's carried in the URL (not router state)
  // so PayMongo's cancel redirect can bring the customer back to this same single-item checkout.
  const buySlug = searchParams.get('buy');
  const buyQty = Math.max(1, parseInt(searchParams.get('qty'), 10) || 1);
  const [buyNowProduct, setBuyNowProduct] = useState(null); // null = loading, false = unavailable

  useEffect(() => {
    if (!buySlug) return;
    setBuyNowProduct(null);
    api.get(`/products/${encodeURIComponent(buySlug)}`).then(setBuyNowProduct).catch(() => setBuyNowProduct(false));
  }, [buySlug]);

  const buyNowItem = buyNowProduct && buyNowProduct.stock > 0 ? {
    productId: buyNowProduct.id,
    name: buyNowProduct.name,
    price: buyNowProduct.price,
    image: buyNowProduct.image,
    slug: buyNowProduct.slug,
    stock: buyNowProduct.stock,
    quantity: Math.min(buyQty, buyNowProduct.stock),
  } : null;

  // From the cart, only the items ticked on the cart page are ordered; the rest stay behind.
  const items = buySlug ? (buyNowItem ? [buyNowItem] : []) : cart.selectedItems;
  const subtotal = buySlug ? (buyNowItem ? buyNowItem.price * buyNowItem.quantity : 0) : cart.selectedTotal;

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

  // PayMongo's cancel link lands here as ?pcid=<checkout>. Ending that checkout puts the stock it
  // was holding back on sale now, not when the hold runs out. The server asks PayMongo first, so a
  // payment that did land still turns into the order here.
  const cancelledId = searchParams.get('pcid');
  useEffect(() => {
    if (!cancelledId) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('pcid');
      return next;
    }, { replace: true });
    api.post(`/payments/cancel/${cancelledId}`, {}).then((res) => {
      if (res.status === 'succeeded' && res.order) {
        if (!buySlug) cart.removeItems(res.order.items.map(i => i.product_id));
        refreshWishlist(); // the server drops ordered products from the wishlist
        setConfirmedOrder(res.order);
      } else if (res.status === 'processing') {
        setError("Payment wasn't completed. If you did pay, the order will show up in My Orders in a few minutes.");
      }
    }).catch(() => {}); // the hold runs out on its own
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelledId]);

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
  const { shippingFee, tax, taxRate, total: orderTotal, toFreeShipping } =
    orderCharges(Math.max(0, subtotal - holidayAmt - voucherAmt), settings);
  // A store with no shipping fee set has nothing to say about shipping, not "Free" on every order.
  const chargesShipping = Number(settings.shippingFee) > 0;

  // Step 1: build a receipt preview from what's already validated on the client — nothing is
  // sent to the server yet, so nothing is charged, no stock moves, and no email goes out.
  const handleReview = (e) => {
    e.preventDefault();
    const selectedAddress = addressRef.current?.validate();
    if (!selectedAddress) { setError('Please select or add a shipping address.'); return; }
    const payment = paymentRef.current?.validate();
    if (!payment) return;

    setError('');
    cardRef.current = payment.card || null;
    setPendingOrder({
      items: items.map(i => ({ id: i.productId, name: i.name, image: i.image, price: i.price, quantity: i.quantity })),
      shipping_address: selectedAddress.fullAddress,
      payment_method: payment.method,
      promo_code: appliedPromo?.code || null,
      subtotal,
      discount: holidayAmt + voucherAmt,
      shipping_fee: shippingFee,
      tax,
      tax_rate: taxRate,
      total: orderTotal,
    });
  };

  // Step 2: only now does the order actually get placed. Bank transfer and cash on delivery
  // create the order immediately (payment_status 'pending' — settled later by a staff member
  // verifying the deposit, or by the order being marked delivered). A newly entered card is
  // charged right here: tokenized straight to PayMongo, then charged by our backend, which
  // returns the finished order — no PayMongo page in between, unless the card's bank asks for
  // 3-D Secure. GCash, QR Ph, and a saved card hand off to PayMongo's hosted Checkout Session,
  // so their order is only created once PayMongo confirms the charge (via /checkout/return).
  const handleConfirmOrder = async () => {
    setPlacingOrder(true);
    setError('');
    try {
      if (pendingOrder.payment_method === 'card' && cardRef.current) {
        const paymentMethodId = await createCardPaymentMethod({
          ...cardRef.current,
          billing: user ? { name: `${user.firstName} ${user.lastName}`, email: user.email } : undefined,
        });
        const result = await api.post('/payments/card-payment', {
          items: pendingOrder.items.map(i => ({ productId: i.id, quantity: i.quantity })),
          shippingAddress: pendingOrder.shipping_address,
          promoCode: pendingOrder.promo_code || undefined,
          buyNow: Boolean(buySlug),
          paymentMethodId,
        });

        if (result.status === 'succeeded') {
          cardRef.current = null;
          if (!buySlug) cart.removeItems(result.order.items.map(i => i.product_id));
          refreshWishlist(); // the server drops ordered products from the wishlist
          setPendingOrder(null);
          setConfirmedOrder(result.order);
        } else if (result.redirectUrl) {
          // The card's bank wants 3-D Secure — CheckoutReturn picks up once it sends them back.
          window.location.href = result.redirectUrl;
        } else {
          const params = new URLSearchParams({ pcid: result.pendingCheckoutId });
          if (buySlug) { params.set('buy', buySlug); params.set('qty', String(pendingOrder.items[0].quantity)); }
          navigate(`/checkout/return?${params}`, { replace: true });
        }
        return;
      }

      if (isOfflinePayment(pendingOrder.payment_method)) {
        const order = await api.post('/orders', {
          items: pendingOrder.items.map(i => ({ productId: i.id, quantity: i.quantity })),
          shippingAddress: pendingOrder.shipping_address,
          paymentMethod: pendingOrder.payment_method,
          promoCode: pendingOrder.promo_code || undefined,
        });
        if (!buySlug) cart.removeItems(order.items.map(i => i.product_id));
        refreshWishlist(); // the server drops ordered products from the wishlist
        setPendingOrder(null);
        setConfirmedOrder(order);
        return;
      }

      const { checkoutUrl } = await api.post('/payments/checkout-session', {
        items: pendingOrder.items.map(i => ({ productId: i.id, quantity: i.quantity })),
        shippingAddress: pendingOrder.shipping_address,
        paymentMethod: pendingOrder.payment_method,
        promoCode: pendingOrder.promo_code || undefined,
        buyNow: Boolean(buySlug),
      });
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err.message);
      // Another customer confirmed first and got the stock: bring this page's counts up to date.
      if (err.code === 'insufficient_stock') {
        if (buySlug) api.get(`/products/${encodeURIComponent(buySlug)}`).then(setBuyNowProduct).catch(() => setBuyNowProduct(false));
        else cart.refresh();
      }
    } finally {
      setPlacingOrder(false);
    }
  };

  // Show the receipt — with its own confirmation banner — before sending the customer
  // anywhere else. Checked ahead of the empty-cart guard below, since removeItems() just ran
  // and would otherwise make that guard hijack this render with "your cart is empty".
  // Leaving replaces this /checkout entry rather than pushing /orders on top of it — the
  // checkout session is over, so there's nothing left here to come back to; without
  // replace, browser back lands right back on this same confirmed-order view.
  if (confirmedOrder) {
    return (
      <OrderDetailsModal
        order={confirmedOrder}
        justConfirmed
        person={user ? { name: `${user.firstName} ${user.lastName}`, email: user.email } : null}
        personLabel="Billed To"
        onClose={() => navigate('/orders', { replace: true })}
        onDismiss={() => navigate('/', { replace: true })}
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

  if (buySlug && buyNowProduct === null) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <Loader2 className="w-10 h-10 text-brand-teal mx-auto animate-spin" />
      </div>
    );
  }

  if (buySlug && !buyNowItem) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-bold text-brand-ink mb-2">This product isn't available</h2>
        <p className="text-gray-500 mb-6">It may have sold out or been removed from the store.</p>
        <Link to="/products" className="btn-primary">Browse Products</Link>
      </div>
    );
  }

  if (items.length === 0 && cart.items.length > 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-bold text-brand-ink mb-2">No items selected</h2>
        <p className="text-gray-500 mb-6">Tick the items you want to buy in your cart, then check out.</p>
        <Link to="/cart" className="btn-primary">Back to Cart</Link>
      </div>
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
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-brand-navy transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <p className="eyebrow mb-3">Final Step</p>
      <h1 className="section-title mb-8">Checkout</h1>

      <form onSubmit={handleReview} className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
        <div className="space-y-6">
          <section className="card p-6">
            <AddressPicker ref={addressRef} stepNumber={1} title="Shipping Address" />
          </section>

          <section className="card p-6">
            <PaymentMethodPicker ref={paymentRef} stepNumber={2} allowCashOnDelivery chargeCardHere={canChargeCardsInline} />
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
            {buySlug && (
              <p className="text-xs text-gray-400 -mt-2 mb-4">Buying this item only — your cart stays as it is.</p>
            )}

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
              {chargesShipping && (
                <div className="flex justify-between text-gray-500">
                  <span>Shipping</span>
                  {shippingFee > 0 ? <span>{formatPrice(shippingFee)}</span> : <span className="text-green-600 font-medium">Free</span>}
                </div>
              )}
              {toFreeShipping != null && (
                <p className="text-xs text-brand-teal">Add {formatPrice(toFreeShipping)} more for free shipping.</p>
              )}
            </div>

            <div className="flex justify-between items-center font-bold text-lg mt-3 pt-3 border-t border-gray-200">
              <span className="text-brand-ink">Total</span>
              <span className="text-brand-navy">{formatPrice(orderTotal)}</span>
            </div>
            {tax > 0 && (
              <p className="text-right text-xs text-gray-400 mt-1">Includes {formatPrice(tax)} VAT ({taxRate}%)</p>
            )}

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
                <p className="text-[11px] text-gray-400 leading-tight">{settings.deliveryEstimate ? `Arrives in ${settings.deliveryEstimate}` : 'Fast Delivery'}</p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
