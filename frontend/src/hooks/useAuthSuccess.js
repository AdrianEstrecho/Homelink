import { useEffect, useRef, useState } from 'react';
import { usePageTransition } from '../context/PageTransitionContext';

// Holds for a beat after a successful sign-in/sign-up so the auth scene can
// light every window before the full-screen cover (App.jsx) takes over.
// Skipped under reduced motion, where the scene doesn't animate anyway.
const CELEBRATION_MS = 600;

export default function useAuthSuccess() {
  const coverTransitionTo = usePageTransition();
  const [succeeded, setSucceeded] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const finish = (path) => {
    setSucceeded(true);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => coverTransitionTo(path), reducedMotion ? 0 : CELEBRATION_MS);
  };

  return { succeeded, finish };
}
