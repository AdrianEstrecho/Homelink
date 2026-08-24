import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const GUEST_CART_KEY = 'homelink_cart';

function loadGuestCart() {
  try { return JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]'); } catch { return []; }
}

function withAddedItem(prev, product, qty) {
  const existing = prev.find(i => i.productId === product.id);
  if (existing) return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + qty } : i);
  return [...prev, { productId: product.id, name: product.name, price: product.price, image: product.image, slug: product.slug, quantity: qty, stock: product.stock }];
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const isAccountCart = user?.role === 'customer';
  const [items, setItems] = useState(() => (isAccountCart ? [] : loadGuestCart()));
  const mergedUserId = useRef(null);

  // Not signed in as a customer: the cart lives in this browser only, same as before.
  useEffect(() => {
    if (isAccountCart) return;
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  }, [items, isAccountCart]);

  const refresh = useCallback(() => {
    if (!isAccountCart) return;
    api.get('/cart/my').then(setItems).catch(() => setItems([]));
  }, [isAccountCart]);

  // On login, fold whatever was sitting in the guest cart into the account cart once, then
  // load from the server from then on so the cart follows the account across devices/browsers.
  // On logout, fall back to localStorage and reset so the next login merges again.
  useEffect(() => {
    if (!isAccountCart) {
      setItems(loadGuestCart());
      mergedUserId.current = null;
      return;
    }
    if (mergedUserId.current === user.id) return;
    mergedUserId.current = user.id;

    const guestItems = loadGuestCart();
    const request = guestItems.length
      ? api.post('/cart/merge', { items: guestItems.map(i => ({ productId: i.productId, quantity: i.quantity })) })
      : api.get('/cart/my');
    request
      .then(serverItems => {
        setItems(serverItems);
        localStorage.removeItem(GUEST_CART_KEY);
      })
      .catch(() => { mergedUserId.current = null; refresh(); });
  }, [isAccountCart, user?.id, refresh]);

  const addItem = (product, qty = 1) => {
    setItems(prev => withAddedItem(prev, product, qty));
    if (!isAccountCart) return;
    api.post('/cart', { productId: product.id, quantity: qty }).then(setItems).catch(refresh);
  };

  const removeItem = (productId) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
    if (!isAccountCart) return;
    api.delete(`/cart/${productId}`).then(setItems).catch(refresh);
  };

  const updateQty = (productId, quantity) => {
    if (quantity <= 0) return removeItem(productId);
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity } : i));
    if (!isAccountCart) return;
    api.put(`/cart/${productId}`, { quantity }).then(setItems).catch(refresh);
  };

  const clearCart = () => {
    setItems([]);
    if (!isAccountCart) return;
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
