import { createContext, useContext } from 'react';

// Lets any page trigger the full-screen delivery transition that lives in App.jsx —
// e.g. Login/Register calling it on auth success, Navbar/Account on logout — without
// threading a prop through <Routes>. Call it as coverTransitionTo(path), or
// coverTransitionTo(path, { reload: true, before }) to run `before` and reload the
// page at `path` once the screen is covered.
const PageTransitionContext = createContext(null);

export function PageTransitionProvider({ value, children }) {
  return <PageTransitionContext.Provider value={value}>{children}</PageTransitionContext.Provider>;
}

export function usePageTransition() {
  const ctx = useContext(PageTransitionContext);
  if (!ctx) throw new Error('usePageTransition must be used within PageTransitionProvider');
  return ctx;
}
