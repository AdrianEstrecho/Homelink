import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import SafeImage from './SafeImage';

// A full-screen viewer rather than a panel, so it keeps its own dark layout instead of Modal.jsx —
// but behaves like the other dialogs: announced as one, focus starts on Close and goes back to
// the photo that opened it, and Tab cycles through its own controls instead of the page behind.
export default function GalleryLightbox({ items, index, onClose, onNavigate }) {
  const item = items[index];
  const rootRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    return () => { if (opener && document.contains(opener)) opener.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Tab') {
        const controls = [...(rootRef.current?.querySelectorAll('button') || [])];
        if (!controls.length) return;
        const at = controls.indexOf(document.activeElement);
        e.preventDefault();
        const next = e.shiftKey ? (at <= 0 ? controls.length - 1 : at - 1) : (at + 1) % controls.length;
        controls[next].focus();
      } else if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onNavigate((index - 1 + items.length) % items.length);
      else if (e.key === 'ArrowRight') onNavigate((index + 1) % items.length);
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, items.length, onClose, onNavigate]);

  if (!item) return null;

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 fade-up"
      style={{ animationDuration: '0.2s' }}
    >
      <div className="absolute inset-0 bg-brand-ink/95 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <button ref={closeRef} onClick={onClose} aria-label="Close" className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10">
        <X className="w-5 h-5" />
      </button>

      {items.length > 1 && (
        <>
          <button
            onClick={() => onNavigate((index - 1 + items.length) % items.length)}
            aria-label="Previous image"
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => onNavigate((index + 1) % items.length)}
            aria-label="Next image"
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      <div className="relative max-w-4xl w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <SafeImage
          src={item.image}
          alt={item.title}
          className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-2xl bg-white/5"
          iconClassName="w-12 h-12 text-white/40"
        />
        <div className="text-center mt-5" aria-live="polite">
          {item.category && <p className="eyebrow text-brand-orange justify-center mb-1.5">{item.category}</p>}
          <h3 className="font-display text-xl font-bold text-white">{item.title}</h3>
          {items.length > 1 && <p className="text-sm text-white/50 mt-1.5">{index + 1} / {items.length}</p>}
        </div>
      </div>
    </div>,
    document.body
  );
}
