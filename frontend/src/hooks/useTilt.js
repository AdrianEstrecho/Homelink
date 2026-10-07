import { useRef } from 'react';

const MAX_DEG = 5;

// Pointer handlers that lean a card toward the mouse and move its glare to it (.tilt and
// .tilt-glare in motion.css). The angles go straight onto CSS variables on the element, at most
// once a frame, so following the mouse never re-renders. Touch and pen are ignored: they get
// the plain hover state.
export function useTilt() {
  const frame = useRef(0);

  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.currentTarget;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const x = (clientX - r.left) / r.width;
      const y = (clientY - r.top) / r.height;
      el.style.setProperty('--tilt-x', `${(0.5 - y) * MAX_DEG * 2}deg`);
      el.style.setProperty('--tilt-y', `${(x - 0.5) * MAX_DEG * 2}deg`);
      el.style.setProperty('--glare-x', `${x * 100}%`);
      el.style.setProperty('--glare-y', `${y * 100}%`);
    });
  };

  const onPointerLeave = () => cancelAnimationFrame(frame.current);

  return { onPointerMove, onPointerLeave };
}
