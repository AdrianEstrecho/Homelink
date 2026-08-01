import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Tag, MapPin } from 'lucide-react';
import { api, formatPrice } from '../api/client';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import Select from '../components/Select';

const PAYMENT_METHOD_OPTIONS = [
  { value: 'card', label: 'Credit/Debit Card' },
  { value: 'gcash', label: 'GCash' },
  { value: 'bank', label: 'Bank Transfer' },
];

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [address, setAddress] = useState(user?.address || '');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/orders', {
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        shippingAddress: address,
        paymentMethod,
        promoCode: promoCode || undefined,
      });
      clearCart();
      navigate('/orders');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-brand-navy mb-8">Checkout</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6">
          <h2 className="font-semibold mb-4">Order Summary</h2>
          {items.map(i => (
            <div key={i.productId} className="flex justify-between text-sm py-2 border-b last:border-0">
              <span>{i.name} x{i.quantity}</span>
              <span className="font-medium">{formatPrice(i.price * i.quantity)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-lg mt-4 pt-4 border-t">
            <span>Total</span>
            <span className="text-brand-orange">{formatPrice(total)}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 flex items-center gap-1"><MapPin className="w-4 h-4" /> Shipping Address</label>
          <textarea required value={address} onChange={e => setAddress(e.target.value)} rows={2} className="input-field" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 flex items-center gap-1"><Tag className="w-4 h-4" /> Promo Code</label>
          <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="e.g. HOMELINK10" className="input-field" />
          <p className="text-xs text-gray-500 mt-1">Try: HOMELINK10, SAVE500, NEWHOME20</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 flex items-center gap-1"><CreditCard className="w-4 h-4" /> Payment Method</label>
          <Select value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHOD_OPTIONS} />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 disabled:opacity-50">
          {loading ? 'Processing Payment...' : `Pay ${formatPrice(total)}`}
        </button>
      </form>
    </div>
  );
}
