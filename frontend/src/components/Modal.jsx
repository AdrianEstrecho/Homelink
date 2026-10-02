import { createContext, forwardRef, useContext, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// The one dialog shell every modal in the app is built on. It owns what each used to do by
// hand (or not at all): portaling to <body>, the scrim, a bottom sheet on phones and a centered
// panel from sm up, moving focus in and keeping Tab inside, Escape, locking the page's scroll,
// and handing focus back to whatever opened it. Content goes in as <ModalHeader>, <ModalBody>
// and <ModalFooter>, or anything custom — the panel is a flex column, so a body that scrolls
// sits between a header and footer that don't.
//
// Portaled because `fixed inset-0` only centers on the viewport when no ancestor has a
// transform, filter or backdrop-filter (e.g. Navbar's blurred sticky bar) — otherwise it gets
// boxed into that ancestor. `position: fixed` on the root is also what Select.jsx looks for to
// open its panels inside the viewport instead of below the fold.

const ModalContext = createContext(null);

// Open modals, innermost last: Escape and the focus trap only answer to the top one.
const openStack = [];
let scrollLocks = 0;
let savedOverflow = '';

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-3xl',
};

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

// Footer buttons: full width and stacked (primary on top) on phones, side by side from sm up.
export const modalButton = {
  base: 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition w-full sm:w-auto sm:min-w-[7rem] disabled:opacity-50 disabled:cursor-not-allowed',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400',
  primary: 'bg-brand-orange text-white hover:bg-orange-600',
  navy: 'bg-brand-navy text-white hover:bg-brand-blue',
};

export default function Modal({
  open = true,
  onClose,
  // false while something is saving: Escape, the scrim and the header's close button stop working.
  dismissible = true,
  size = 'md',
  as: Panel = 'div',
  role = 'dialog',
  zIndex = 100,
  className = '',
  scrimClassName = '',
  children,
  ...panelProps
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const close = dismissible && onClose ? onClose : null;
  const closeRef = useRef(close);
  closeRef.current = close;

  // Read during render, before any autoFocus inside the dialog runs in the commit — by the
  // time an effect could look, focus has already moved into the dialog.
  const returnFocusRef = useRef(null);
  if (open && !returnFocusRef.current) returnFocusRef.current = document.activeElement;

  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    const entry = {};
    openStack.push(entry);
    if (scrollLocks++ === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    if (!panel.contains(document.activeElement)) panel.focus({ preventScroll: true });

    const onKeyDown = (e) => {
      if (openStack[openStack.length - 1] !== entry) return;
      if (e.key === 'Escape') {
        // Something inside already used this Escape (an open suggestion list), or a Select
        // panel is showing — let that close first.
        if (e.defaultPrevented || document.querySelector('[data-select-panel]')) return;
        if (closeRef.current) {
          e.preventDefault();
          closeRef.current();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = [...panel.querySelectorAll(FOCUSABLE)].filter(n => n.getClientRects().length > 0);
      if (!nodes.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openStack.splice(openStack.indexOf(entry), 1);
      if (--scrollLocks === 0) document.body.style.overflow = savedOverflow;
      const back = returnFocusRef.current;
      returnFocusRef.current = null;
      if (back && back !== document.body && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-6" style={{ zIndex }}>
      <div className={`dialog-scrim ${scrimClassName}`} onClick={() => closeRef.current?.()} aria-hidden="true" />
      <ModalContext.Provider value={{ titleId, close }}>
        <Panel
          ref={panelRef}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`dialog-panel relative flex flex-col w-full ${SIZES[size] || SIZES.md} max-h-[92dvh] sm:max-h-[88vh] outline-none ${className}`}
          {...panelProps}
        >
          {children}
        </Panel>
      </ModalContext.Provider>
    </div>,
    document.body
  );
}

const ICON_TONES = {
  brand: 'bg-brand-navy/[0.07] text-brand-navy',
  orange: 'bg-brand-orange/10 text-[#c8461a]',
  red: 'bg-red-50 text-red-600',
  purple: 'bg-purple-50 text-purple-600',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  teal: 'bg-teal-50 text-[#00806f]',
};

// Title row: optional tinted icon, the title (which names the dialog for screen readers),
// a subtitle, any extra controls (`actions`), and the close button.
export function ModalHeader({ icon: Icon, tone = 'brand', title, subtitle, actions, className = '', children }) {
  const { titleId } = useContext(ModalContext);
  return (
    <div className={`dialog-head shrink-0 flex items-start gap-3.5 px-5 sm:px-6 pt-5 pb-4 border-b border-[#eef1f5] ${className}`}>
      {Icon && (
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ICON_TONES[tone] || ICON_TONES.brand}`} aria-hidden="true">
          <Icon className="w-5 h-5" />
        </span>
      )}
      <div className="flex-1 min-w-0 pt-0.5">
        <h2 id={titleId} className="font-display text-lg font-bold leading-snug text-brand-ink">{title}</h2>
        {subtitle && <div className="text-sm text-gray-500 mt-0.5">{subtitle}</div>}
        {children}
      </div>
      {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
      <ModalCloseButton className="-mr-2 -mt-1" />
    </div>
  );
}

// For dialogs that lay out their own heading: gives it the id the dialog is named by.
export const ModalTitle = forwardRef(function ModalTitle({ as: Tag = 'h2', className = '', children, ...props }, ref) {
  const { titleId } = useContext(ModalContext);
  return <Tag ref={ref} id={titleId} className={className} {...props}>{children}</Tag>;
});

export function ModalCloseButton({ className = '' }) {
  const { close } = useContext(ModalContext);
  return (
    <button
      type="button"
      onClick={() => close?.()}
      disabled={!close}
      aria-label="Close"
      className={`shrink-0 p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition disabled:opacity-40 disabled:hover:bg-transparent ${className}`}
    >
      <X className="w-[18px] h-[18px]" />
    </button>
  );
}

// The part that scrolls. Takes a ref and extra props (e.g. onScroll) for dialogs that watch it.
export const ModalBody = forwardRef(function ModalBody({ className = '', children, ...props }, ref) {
  return <div ref={ref} className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 ${className}`} {...props}>{children}</div>;
});

export function ModalFooter({ className = '', children }) {
  return (
    <div className={`dialog-foot shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 px-5 sm:px-6 pt-4 border-t border-[#eef1f5] bg-[#f8fafc] ${className}`}>
      {children}
    </div>
  );
}
