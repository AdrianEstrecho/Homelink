import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('homelink_cart') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('homelink_cart', JSON.stringify(items));
  }, [items]);

  const addItem = (product, qty = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + qty } : i);
      return [...prev, { productId: product.id, name: product.name, price: product.price, image: product.image, slug: product.slug, quantity: qty, stock: product.stock }];
    });
  };

  const removeItem = (productId) => setItems(prev => prev.filter(i => i.productId !== productId));
  const updateQty = (productId, quantity) => {
    if (quantity <= 0) return removeItem(productId);
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity } : i));
  };
  const clearCart = () => setItems([]);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
