import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export default function Select({ value, onChange, options, placeholder = 'Select...', disabled, className = '', defaultOpen = false, onClose }) {
  const [open, setOpen] = useState(defaultOpen);
  const [coords, setCoords] = useState(null);
  const ref = useRef(null);
  const btnRef = useRef(null);

  const close = () => { setOpen(false); onClose?.(); };

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (e.target.closest('[data-select-panel]')) return;
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Position the panel via a portal so it always escapes any scrollable/overflow
  // ancestor (e.g. a table wrapper) instead of being clipped by it.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const updateCoords = () => {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    };
    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`input-field flex items-center justify-between gap-2 text-left ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`truncate ${selected ? 'text-gray-800' : 'text-gray-400'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled && coords && createPortal(
        <div
          data-select-panel
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width }}
          className="z-[200] bg-white rounded-lg shadow-lg border border-gray-100 max-h-60 overflow-y-auto py-1"
        >
          {options.map(o => (
            <button
              type="button"
              key={o.value}
              onClick={() => { onChange(o.value); close(); }}
              className={`w-full text-left px-3 py-2 text-sm transition ${o.value === value ? 'bg-brand-navy/10 text-brand-navy font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {o.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
