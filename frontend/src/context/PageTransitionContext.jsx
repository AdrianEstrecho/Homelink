import { createContext, useContext } from 'react';

// Lets any page (not just Navbar, which App.jsx can prop-drill directly)
// trigger the full-screen cover transition — e.g. Login/Register calling it
// on auth success, without threading a prop through <Routes>.
const PageTransitionContext = createContext(null);

export function PageTransitionProvider({ value, children }) {
  return <PageTransitionContext.Provider value={value}>{children}</PageTransitionContext.Provider>;
}

export function usePageTransition() {
  const ctx = useContext(PageTransitionContext);
  if (!ctx) throw new Error('usePageTransition must be used within PageTransitionProvider');
  return ctx;
}
