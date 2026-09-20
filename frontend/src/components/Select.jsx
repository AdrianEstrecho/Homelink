import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

const PANEL_GAP = 6;
const VIEWPORT_MARGIN = 12;
const PANEL_MAX_HEIGHT = 240;
const PANEL_MIN_HEIGHT = 120;
const OPTION_HEIGHT = 36;
const SEARCH_ROW_HEIGHT = 44;
// A Philippine city can have close to 900 barangays. They all stay searchable, but only this
// many are put in the DOM at once — past that the panel is a wall of options nobody scrolls
// through anyway, and the honest move is to tell the person to keep typing.
const MAX_RENDERED_OPTIONS = 100;
const PAGE_MIN_HEIGHT_VAR = '--select-panel-page-min-height';

// A modal (fixed inset-0 overlay) doesn't move when the page scrolls, so a panel opened from
// inside one can't be revealed by scrolling the page — it has to fit in the viewport instead.
function hasFixedAncestor(el) {
  for (let node = el?.parentElement; node && node !== document.body; node = node.parentElement) {
    if (getComputedStyle(node).position === 'fixed') return true;
  }
  return false;
}

const sameCoords = (a, b) => !!a && !!b && Object.keys(b).every(k => a[k] === b[k]) && Object.keys(a).length === Object.keys(b).length;

export default function Select({
  value, onChange, options, placeholder = 'Select...', disabled, className = '', defaultOpen = false, onClose,
  searchable = false, searchPlaceholder = 'Search...', emptyLabel = 'No matches',
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [coords, setCoords] = useState(null);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const close = () => { setOpen(false); setQuery(''); onClose?.(); };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);
  const visible = searchable ? matches.slice(0, MAX_RENDERED_OPTIONS) : matches;
  const hiddenCount = matches.length - visible.length;

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

  // The panel is portaled to <body> so it always escapes any scrollable/overflow ancestor
  // (e.g. a table wrapper) instead of being clipped by it. On a normal page it's placed in
  // page coordinates (position: absolute), so a panel that runs past the bottom of the screen
  // extends the page and can be scrolled to. Inside a modal it stays position: fixed, opening
  // upward when there's more room above, and capped to the space available.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return undefined;
    const inFixedLayer = hasFixedAncestor(btnRef.current);
    const estimatedHeight = Math.min(PANEL_MAX_HEIGHT, options.length * OPTION_HEIGHT + 8 + (searchable ? SEARCH_ROW_HEIGHT : 0));
    const updateCoords = () => {
      const rect = btnRef.current.getBoundingClientRect();
      let next;
      if (!inFixedLayer) {
        next = { mode: 'page', top: rect.bottom + PANEL_GAP + window.scrollY, left: rect.left + window.scrollX, width: rect.width };
      } else {
        const spaceBelow = window.innerHeight - rect.bottom - PANEL_GAP - VIEWPORT_MARGIN;
        const spaceAbove = rect.top - PANEL_GAP - VIEWPORT_MARGIN;
        const openUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
        const maxHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow));
        next = openUp
          ? { mode: 'fixed', bottom: window.innerHeight - rect.top + PANEL_GAP, left: rect.left, width: rect.width, maxHeight }
          : { mode: 'fixed', top: rect.bottom + PANEL_GAP, left: rect.left, width: rect.width, maxHeight };
      }
      setCoords(prev => (sameCoords(prev, next) ? prev : next));
    };
    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
      setCoords(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // An absolutely-positioned panel grows the document on its own, but not the app's layout
  // wrapper — so publish the page height it needs (panel bottom plus a margin) for AdminLayout
  // to stretch to, keeping its background and sticky sidebar covering the extra scroll room.
  useLayoutEffect(() => {
    if (coords?.mode !== 'page' || !panelRef.current) return undefined;
    const html = document.documentElement;
    html.style.setProperty(PAGE_MIN_HEIGHT_VAR, `${Math.ceil(coords.top + panelRef.current.offsetHeight + VIEWPORT_MARGIN)}px`);
    return () => html.style.removeProperty(PAGE_MIN_HEIGHT_VAR);
  }, [coords?.mode, coords?.top]);

  // Once a page-placed panel is on screen, scroll just far enough to show all of it
  // (a no-op when it already fits).
  useEffect(() => {
    if (coords?.mode !== 'page' || !panelRef.current) return;
    panelRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [coords?.mode]);

  const selected = options.find(o => o.value === value);

  const panelStyle = !coords ? null : coords.mode === 'page'
    ? { position: 'absolute', top: coords.top, left: coords.left, width: coords.width, maxHeight: PANEL_MAX_HEIGHT, scrollMarginBottom: VIEWPORT_MARGIN }
    : { position: 'fixed', top: coords.top, bottom: coords.bottom, left: coords.left, width: coords.width, maxHeight: coords.maxHeight };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        className={`input-field flex items-center justify-between gap-2 text-left ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`truncate ${selected ? 'text-gray-800' : 'text-gray-400'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled && coords && createPortal(
        <div
          ref={panelRef}
          data-select-panel
          style={panelStyle}
          className="z-[200] bg-white rounded-lg shadow-lg border border-gray-100 overflow-y-auto py-1"
        >
          {searchable && (
            // Sticky so the box stays reachable while scrolling a long list, and it swallows
            // Enter/Escape so neither reaches (and submits or closes) the form behind it.
            <div className="sticky top-0 z-10 bg-white px-2 pt-1 pb-2 border-b border-gray-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    if (visible.length) { onChange(visible[0].value); close(); }
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full text-sm pl-8 pr-2 py-1.5 rounded-md border border-gray-200 focus:outline-none focus:border-brand-orange"
                />
              </div>
            </div>
          )}
          {visible.map(o => (
            <button
              type="button"
              key={o.value}
              onClick={() => { onChange(o.value); close(); }}
              className={`w-full text-left px-3 py-2 text-sm transition ${o.value === value ? 'bg-brand-navy/10 text-brand-navy font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {o.label}
            </button>
          ))}
          {!visible.length && <p className="px-3 py-2 text-sm text-gray-400">{emptyLabel}</p>}
          {hiddenCount > 0 && <p className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">{hiddenCount} more — keep typing to narrow it down</p>}
        </div>,
        document.body
      )}
    </div>
  );
}
