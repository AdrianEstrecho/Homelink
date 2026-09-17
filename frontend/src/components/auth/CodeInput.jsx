import { Fragment, useRef, useState } from 'react';

const sanitize = (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

// Segmented entry for the 8-character email codes. It's one real <input> laid
// invisibly over the cells rather than one input per character, so paste
// (including "ABCD-EFGH" with a dash), one-time-code autofill, mobile keyboards
// and screen readers all see an ordinary text field — the cells only mirror
// its value. Calls onComplete with the full code as soon as the last cell fills.
export default function CodeInput({
  id,
  value,
  onChange,
  onComplete,
  length = 8,
  invalid = false,
  disabled = false,
  autoFocus = false,
  labelledBy,
  describedBy,
}) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, length - 1);

  const handleChange = (e) => {
    const next = sanitize(e.target.value).slice(0, length);
    onChange(next);
    if (next.length === length && value.length !== length) onComplete?.(next);
  };

  // The caret is invisible, so keep it pinned to the end — otherwise a click
  // could drop it mid-value and typing would land in a cell out of order.
  const pinCaret = () => {
    const el = inputRef.current;
    if (!el) return;
    const end = el.value.length;
    if (el.selectionStart !== end || el.selectionEnd !== end) el.setSelectionRange(end, end);
  };

  return (
    <div className={`relative ${disabled ? 'opacity-60' : ''}`}>
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={handleChange}
        onFocus={() => { setFocused(true); pinCaret(); }}
        onBlur={() => setFocused(false)}
        onSelect={pinCaret}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        // 16px text stops iOS Safari zooming in on focus.
        className="absolute inset-0 z-10 w-full h-full opacity-0 text-base cursor-text disabled:cursor-not-allowed"
      />
      <div className="flex items-center gap-1.5 sm:gap-2" aria-hidden="true">
        {Array.from({ length }, (_, i) => {
          const char = value[i];
          const active = focused && i === activeIndex;
          const tone = invalid
            ? 'border-red-300 bg-red-50/60'
            : active
              ? 'border-brand-orange bg-white shadow-[0_0_0_4px_rgba(255,107,53,0.14)]'
              : char
                ? 'border-brand-navy/25 bg-white'
                : 'border-gray-200 bg-gray-50';
          return (
            <Fragment key={i}>
              {i === length / 2 && <span className="w-2 sm:w-3 h-0.5 shrink-0 rounded-full bg-gray-300" />}
              <div className={`flex-1 min-w-0 h-12 sm:h-14 rounded-xl border-2 flex items-center justify-center font-display text-lg sm:text-xl font-bold text-brand-ink transition-all duration-150 ${tone}`}>
                {char ? (
                  <span key={char} className="auth-pop">{char}</span>
                ) : active ? (
                  <span className="code-caret" />
                ) : null}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
