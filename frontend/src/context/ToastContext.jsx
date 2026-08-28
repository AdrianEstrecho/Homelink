import { createContext, useCallback, useContext, useState } from 'react';
import ToastViewport from '../components/ToastViewport';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const duration = toast.duration ?? 4000;
    // A dedupeKey replaces any toast already showing for the same key instead of
    // stacking a new one on top — used for repeated clicks on a gated action (e.g.
    // "login required") so the toast just resets rather than piling up.
    setToasts(prev => {
      const kept = toast.dedupeKey ? prev.filter(t => t.dedupeKey !== toast.dedupeKey) : prev;
      return [...kept, { id, duration, ...toast }];
    });
    setTimeout(() => dismissToast(id), duration);
    return id;
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
