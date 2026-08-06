import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import SafeImage from './SafeImage';

export default function GalleryLightbox({ items, index, onClose, onNavigate }) {
  const item = items[index];

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 fade-up" style={{ animationDuration: '0.2s' }}>
      <div className="absolute inset-0 bg-brand-ink/95 backdrop-blur-sm" onClick={onClose} />

      <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10">
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
        <div className="text-center mt-5">
          {item.category && <p className="eyebrow text-brand-orange justify-center mb-1.5">{item.category}</p>}
          <h3 className="font-display text-xl font-bold text-white">{item.title}</h3>
          {items.length > 1 && <p className="text-sm text-white/50 mt-1.5">{index + 1} / {items.length}</p>}
        </div>
      </div>
    </div>,
    document.body
  );
}
