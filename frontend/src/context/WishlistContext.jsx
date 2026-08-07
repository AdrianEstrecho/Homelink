import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  const refresh = useCallback(() => {
    if (user?.role !== 'customer') { setItems([]); return; }
    api.get('/wishlist/my').then(setItems).catch(() => setItems([]));
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const has = (productId) => items.some(i => i.id === productId);

  const addItem = async (product) => {
    setItems(prev => prev.some(i => i.id === product.id) ? prev : [product, ...prev]);
    try {
      await api.post('/wishlist', { productId: product.id });
    } catch {
      setItems(prev => prev.filter(i => i.id !== product.id));
    }
  };

  const removeItem = async (productId) => {
    const prevItems = items;
    setItems(prev => prev.filter(i => i.id !== productId));
    try {
      await api.delete(`/wishlist/${productId}`);
    } catch {
      setItems(prevItems);
    }
  };

  return (
    <WishlistContext.Provider value={{ items, count: items.length, has, addItem, removeItem }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
