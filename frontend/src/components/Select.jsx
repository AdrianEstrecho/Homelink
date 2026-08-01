import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Select({ value, onChange, options, placeholder = 'Select...', disabled, className = '', defaultOpen = false, onClose }) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); onClose?.(); }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open, onClose]);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`input-field flex items-center justify-between gap-2 text-left ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`truncate ${selected ? 'text-gray-800' : 'text-gray-400'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled && (
        <div className="absolute z-20 mt-1.5 w-full bg-white rounded-lg shadow-lg border border-gray-100 max-h-60 overflow-y-auto py-1">
          {options.map(o => (
            <button
              type="button"
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); onClose?.(); }}
              className={`w-full text-left px-3 py-2 text-sm transition ${o.value === value ? 'bg-brand-navy/10 text-brand-navy font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
