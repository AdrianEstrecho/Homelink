import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { formatPrice } from '../api/client';
import { useCart } from '../context/CartContext';

export default function Cart() {
  const { items, removeItem, updateQty, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-brand-navy mb-2">Your cart is empty</h2>
        <p className="text-gray-600 mb-6">Browse our products and add items to get started.</p>
        <Link to="/products" className="btn-primary">Browse Products</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-brand-navy mb-8">Shopping Cart</h1>
      <div className="space-y-4 mb-8">
        {items.map(item => (
          <div key={item.productId} className="card p-4 flex gap-4 items-center">
            <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-lg" />
            <div className="flex-1">
              <h3 className="font-semibold">{item.name}</h3>
              <p className="text-brand-orange font-bold">{formatPrice(item.price)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="p-1 hover:bg-gray-100 rounded"><Minus className="w-4 h-4" /></button>
              <span className="w-8 text-center font-medium">{item.quantity}</span>
              <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="p-1 hover:bg-gray-100 rounded"><Plus className="w-4 h-4" /></button>
            </div>
            <p className="font-bold w-24 text-right">{formatPrice(item.price * item.quantity)}</p>
            <button onClick={() => removeItem(item.productId)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <div className="card p-6">
        <div className="flex justify-between text-lg font-bold mb-4">
          <span>Subtotal</span>
          <span className="text-brand-orange">{formatPrice(total)}</span>
        </div>
        <Link to="/checkout" className="btn-primary w-full text-center block py-3">Proceed to Checkout</Link>
      </div>
    </div>
  );
}
