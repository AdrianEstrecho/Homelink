import { forwardRef, useState } from 'react';
import { ArrowBigUp, Check, Eye, EyeOff } from 'lucide-react';

// Labeled input for the auth pages. `valid` shows a check once the value is
// acceptable; `trailing` replaces that slot with a control (PasswordField's
// show/hide toggle). `error` wins over `hint` and is wired to aria-describedby.
export const AuthField = forwardRef(function AuthField(
  { id, label, labelAside, error, hint, valid = false, trailing, className = '', ...inputProps },
  ref
) {
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const hasTrailing = Boolean(trailing) || valid;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <label htmlFor={id} className="text-sm font-medium text-brand-ink">{label}</label>
        {labelAside}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          className={`input-field ${hasTrailing ? 'pr-12' : ''} ${error ? 'border-red-400 bg-red-50/40 focus:ring-red-400' : ''}`}
          {...inputProps}
        />
        {hasTrailing && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            {trailing || (
              <span className="auth-pop w-7 h-7 rounded-full bg-brand-teal/10 flex items-center justify-center">
                <Check className="w-4 h-4 text-teal-700" strokeWidth={2.5} />
              </span>
            )}
          </div>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
});

export const PasswordField = forwardRef(function PasswordField(
  { hint, onKeyDown, onKeyUp, onBlur, ...props },
  ref
) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const readCapsLock = (e) => {
    if (e.getModifierState) setCapsLock(e.getModifierState('CapsLock'));
  };

  return (
    <AuthField
      ref={ref}
      {...props}
      type={visible ? 'text' : 'password'}
      onKeyDown={(e) => { readCapsLock(e); onKeyDown?.(e); }}
      onKeyUp={(e) => { readCapsLock(e); onKeyUp?.(e); }}
      onBlur={(e) => { setCapsLock(false); onBlur?.(e); }}
      hint={capsLock ? (
        <span className="inline-flex items-center gap-1 font-medium text-amber-700">
          <ArrowBigUp className="w-3.5 h-3.5" /> Caps Lock is on
        </span>
      ) : hint}
      trailing={
        <button
          type="button"
          // Keep focus in the field so toggling doesn't interrupt typing.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-brand-navy hover:bg-gray-100 transition"
        >
          {visible ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
        </button>
      }
    />
  );
});
