import { Check, Minus } from 'lucide-react';

// Rounded tick box in the brand orange. The real <input> sits invisibly on top of the
// drawn box, so clicks, keyboard focus, wrapping <label>s and screen readers all work
// as they would with a native checkbox.
export default function Checkbox({ checked, indeterminate = false, onChange, className = '', ...props }) {
  const filled = checked || indeterminate;

  return (
    <span className={`relative inline-flex shrink-0 w-5 h-5 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        ref={el => { if (el) el.indeterminate = indeterminate; }}
        onChange={onChange}
        className="peer absolute inset-0 m-0 opacity-0 cursor-pointer"
        {...props}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-orange/40 peer-focus-visible:ring-offset-2 peer-active:scale-90 ${
          filled
            ? 'bg-brand-orange border-brand-orange shadow-sm shadow-brand-orange/30'
            : 'bg-white border-gray-300 peer-hover:border-brand-orange/70'
        }`}
      >
        {indeterminate ? (
          <Minus className="w-3.5 h-3.5 text-white" strokeWidth={3} />
        ) : (
          <Check className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${checked ? 'scale-100' : 'scale-0'}`} strokeWidth={3} />
        )}
      </span>
    </span>
  );
}
