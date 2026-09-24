import { useEffect, useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

// A text input that offers suggestions without ever insisting on one.
//
// Every address field in the Philippines has entries no register spells the same way —
// subdivisions, phases, sitios, purok numbers — so this stays an ordinary <input>: the list is
// advisory, and whatever is typed is kept as typed unless a suggestion is deliberately chosen.
//
// `fetchSuggestions(query)` returns an array of items; `getLabel`/`getDescription` render one;
// `onSelect(item)` fires only on a real pick, never on plain typing.
export default function AutocompleteInput({
  value, onChange, onSelect, fetchSuggestions,
  getLabel = (item) => item.name,
  getDescription = () => '',
  getKey = (item, i) => item.id ?? i,
  minChars = 1, placeholder, id, inputMode, autoComplete = 'off', className = 'input-field',
}) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);

  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  // Set while a suggestion is being applied, so the resulting value change does not immediately
  // trigger a fresh search for the text we just wrote into the field.
  const skipNextSearch = useRef(false);
  const listId = useId();

  useEffect(() => {
    if (skipNextSearch.current) { skipNextSearch.current = false; return; }
    // Choosing a barangay also rewrites the city and province fields. Only the field actually in
    // use should go looking, or those two would each fire a request nobody asked for.
    if (!open) return;
    const query = (value || '').trim();
    if (query.length < minChars) { setItems([]); setLoading(false); return; }

    // Typing is faster than the round trip, so wait for a pause before asking. `cancelled` drops
    // the reply of any request the next keystroke has already made obsolete — without it a slow
    // response can land after a faster later one and show results for a stale query.
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await fetchSuggestions(query);
        if (!cancelled) { setItems(results || []); setActive(-1); }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => { cancelled = true; clearTimeout(timer); };
    // fetchSuggestions is rebuilt on every render by callers that close over sibling field
    // values; depending on it here would restart the search on each keystroke elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, open, minChars]);

  useEffect(() => {
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, []);

  const choose = (item) => {
    skipNextSearch.current = true;
    onChange(getLabel(item));
    onSelect?.(item);
    setOpen(false);
    setItems([]);
    setActive(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!open || !items.length) {
      // ArrowDown on a field that already has text reopens the last set of suggestions.
      if (e.key === 'ArrowDown' && items.length) setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => (i <= 0 ? items.length : i) - 1);
    } else if (e.key === 'Enter') {
      // Only intercept Enter when a suggestion is actually highlighted, so the key still submits
      // the form for someone typing an address the list does not contain.
      if (active >= 0) { e.preventDefault(); choose(items[active]); }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const showList = open && (items.length > 0 || loading);

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className={className}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
      />

      {loading && (
        <Loader2 className="w-4 h-4 text-gray-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      )}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1"
        >
          {items.map((item, i) => (
            <li
              key={getKey(item, i)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // onMouseDown, not onClick: the input's blur would close the list first.
              onMouseDown={(e) => { e.preventDefault(); choose(item); }}
              onMouseEnter={() => setActive(i)}
              className={`px-3 py-2 cursor-pointer text-sm ${i === active ? 'bg-brand-orange/10' : ''}`}
            >
              <span className="block text-brand-ink truncate">{getLabel(item)}</span>
              {getDescription(item) && (
                <span className="block text-xs text-gray-500 truncate">{getDescription(item)}</span>
              )}
            </li>
          ))}
          {loading && !items.length && (
            <li className="px-3 py-2 text-sm text-gray-400">Searching...</li>
          )}
        </ul>
      )}
    </div>
  );
}
