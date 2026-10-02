// A visible label over a form control. Wrapping the control in the <label> ties the two
// together without ids, so placeholders can go back to being examples instead of the only
// name a field has (they vanish as soon as someone starts typing).
export default function FormField({ label, required = false, hint, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-brand-ink mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-gray-400 mt-1.5">{hint}</span>}
    </label>
  );
}
