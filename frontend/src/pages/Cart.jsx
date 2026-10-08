import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, Lock, ShieldCheck, Truck } from 'lucide-react';
import { formatPrice } from '../api/client';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import Reveal from '../components/Reveal';
import SafeImage from '../components/SafeImage';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Cart() {
  const { items, removeItem, updateQty, clearCart, total, count } = useCart();
  const { showToast } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);

  const handleConfirmRemove = () => {
    const item = removeTarget;
    removeItem(item.productId);
    setRemoveTarget(null);
    showToast({
      icon: Trash2,
      iconClass: 'bg-red-100 text-red-600',
      title: 'Removed from cart',
      description: item.name,
    });
  };

  const handleClear = () => {
    clearCart();
    setConfirmClear(false);
  };

  if (items.length === 0) {
    return (
      <Reveal className="max-w-2xl mx-auto px-4 py-24 text-center">
        <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-bold text-brand-ink mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-6">Browse our products and add items to get started.</p>
        <Link to="/products" className="btn-primary">Browse Products</Link>
      </Reveal>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14">
      <div className="flex flex-wrap items-start sm:items-end justify-between gap-3 mb-8">
        <div>
          <p className="eyebrow mb-3">Your Order</p>
          <h1 className="section-title">Shopping Cart</h1>
          <p className="text-gray-500 mt-2">{count} item{count === 1 ? '' : 's'} in your cart</p>
        </div>
        <button
          onClick={() => setConfirmClear(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-red-600 transition"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear Cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
        <div className="space-y-4">
          {items.map((item, i) => {
            const maxQty = item.stock ?? Infinity;
            const lowStock = item.stock != null && item.stock > 0 && item.stock <= 5;

            return (
              <Reveal key={item.productId} delay={Math.min(i, 5) * 60} className="card p-4">
                <div className="flex gap-4">
                  <Link to={`/products/${item.slug}`} className="shrink-0">
                    <SafeImage src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-lg bg-gray-100" />
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <Link to={`/products/${item.slug}`} className="font-semibold text-brand-ink hover:text-brand-orange transition line-clamp-2">
                        {item.name}
                      </Link>
                      <p className="text-brand-navy font-bold mt-1">{formatPrice(item.price)}</p>
                      {lowStock && <p className="text-xs text-red-500 font-medium mt-1">Only {item.stock} left in stock</p>}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="flex items-center gap-2 border border-gray-200 rounded-lg shrink-0">
                        <button
                          onClick={() => updateQty(item.productId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="p-2 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent rounded-l-lg transition"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.productId, item.quantity + 1)}
                          disabled={item.quantity >= maxQty}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="p-2 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent rounded-r-lg transition"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="font-bold w-20 text-right text-brand-ink shrink-0">{formatPrice(item.price * item.quantity)}</p>
                      <button
                        onClick={() => setRemoveTarget(item)}
                        aria-label={`Remove ${item.name} from cart`}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <div className="lg:sticky lg:top-24">
          <Reveal delay={120} className="card p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 mb-4">Order Summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal ({count} item{count === 1 ? '' : 's'})</span>
                <span className="font-medium text-brand-ink">{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Shipping</span>
                <span className="text-xs text-gray-400">Calculated at checkout</span>
              </div>
            </div>

            <div className="flex justify-between items-center font-bold text-lg mt-4 pt-4 border-t border-gray-100">
              <span className="text-brand-ink">Total</span>
              <span className="text-brand-navy">{formatPrice(total)}</span>
            </div>

            <Link to="/checkout" className="btn-primary w-full text-center block py-3 mt-5">Proceed to Checkout</Link>
            <Link to="/products" className="block text-center text-sm text-brand-teal hover:underline mt-3">Continue Shopping</Link>

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
          </Reveal>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        icon={Trash2}
        title="Clear your cart?"
        message="This will remove all items from your cart. This can't be undone."
        confirmLabel="Clear Cart"
        tone="delete"
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
      <ConfirmDialog
        open={!!removeTarget}
        icon={Trash2}
        title="Remove this item?"
        message={removeTarget ? `"${removeTarget.name}" will be removed from your cart.` : ''}
        confirmLabel="Remove"
        tone="delete"
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
