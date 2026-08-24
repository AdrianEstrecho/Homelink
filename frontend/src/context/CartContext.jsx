import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

function withAddedItem(prev, product, qty) {
  const existing = prev.find(i => i.productId === product.id);
  if (existing) return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + qty } : i);
  return [...prev, { productId: product.id, name: product.name, price: product.price, image: product.image, slug: product.slug, quantity: qty, stock: product.stock }];
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const isAccountCart = user?.role === 'customer';
  const [items, setItems] = useState([]);

  const refresh = useCallback(() => {
    if (!isAccountCart) { setItems([]); return; }
    api.get('/cart/my').then(setItems).catch(() => setItems([]));
  }, [isAccountCart]);

  useEffect(() => { refresh(); }, [refresh]);

  // Older builds kept the cart in this browser's localStorage keyed by device rather than
  // account, which let one account's cart bleed into the next account signed in on the same
  // browser. Every add-to-cart entry point already requires being signed in as a customer, so
  // there's no legitimate guest cart to preserve here -- just drop the stale key for good.
  useEffect(() => { localStorage.removeItem('homelink_cart'); }, []);

  const addItem = (product, qty = 1) => {
    if (!isAccountCart) return;
    setItems(prev => withAddedItem(prev, product, qty));
    api.post('/cart', { productId: product.id, quantity: qty }).then(setItems).catch(refresh);
  };

  const removeItem = (productId) => {
    if (!isAccountCart) return;
    setItems(prev => prev.filter(i => i.productId !== productId));
    api.delete(`/cart/${productId}`).then(setItems).catch(refresh);
  };

  const updateQty = (productId, quantity) => {
    if (quantity <= 0) return removeItem(productId);
    if (!isAccountCart) return;
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity } : i));
    api.put(`/cart/${productId}`, { quantity }).then(setItems).catch(refresh);
  };

  const clearCart = () => {
    if (!isAccountCart) { setItems([]); return; }
    setItems([]);
    api.delete('/cart').catch(refresh);
  };

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
