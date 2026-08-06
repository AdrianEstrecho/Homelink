import { useEffect, useState } from 'react';
import { useReveal } from '../hooks/useReveal';

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// "10,000+" -> { target: 10000, decimals: 0, suffix: '+' }
// "4.8/5"   -> { target: 4.8, decimals: 1, suffix: '/5' }
function parseValue(raw) {
  const match = String(raw).match(/^([\d,]+(?:\.\d+)?)(.*)$/);
  if (!match) return { target: 0, decimals: 0, suffix: raw };
  const [, numStr, suffix] = match;
  const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
  return { target: parseFloat(numStr.replace(/,/g, '')), decimals, suffix };
}

function format(n, decimals) {
  return decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString('en-US');
}

// Counts up from 0 to the numeric part of `value` once its own element scrolls
// into view, then keeps whatever trailing text ("+", "/5", ...) came after the
// number static the whole time.
export default function CountUp({ value, duration = 1400, delay = 0, className }) {
  const [ref, inView] = useReveal();
  const { target, decimals, suffix } = parseValue(value);
  const [display, setDisplay] = useState(format(0, decimals));

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(format(target, decimals));
      return;
    }
    let raf;
    const startTimer = setTimeout(() => {
      const start = performance.now();
      const tick = (now) => {
        // Clamp the low end too: the first rAF callback's `now` can land a
        // hair before the `performance.now()` read above, producing a tiny
        // negative t (and, once cubed through the easing curve, a
        // briefly-visible negative number).
        const t = Math.min(1, Math.max(0, (now - start) / duration));
        setDisplay(format(target * easeOutCubic(t), decimals));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(startTimer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [inView, target, decimals, duration, delay]);

  return (
    <span ref={ref} className={className}>
      {display}{suffix}
    </span>
  );
}
