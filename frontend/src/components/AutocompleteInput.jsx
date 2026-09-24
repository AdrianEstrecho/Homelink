import { useEffect, useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

// How long to sit on a keystroke before asking. Long enough that typing a whole word costs one
// request, short enough that a pause feels answered immediately. Fields that cross the network
// raise it (see the street field): when the answer itself takes over a second, waiting a little
// longer to ask costs nothing perceptible and spares a run of requests nobody waits for.
const DEBOUNCE_MS = 180;

// A spinner is only honest once there is a real wait. Province, city and barangay come out of an
// in-memory index in a few milliseconds, so showing one on every keystroke is pure flicker: the
// indicator appears and vanishes faster than it can be read, and makes an instant field look
// busy. It waits this long before admitting to being slow, which in practice means it only ever
// appears for the street lookup, which crosses the network to a geocoder.
const SPINNER_DELAY_MS = 400;

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
  minChars = 1, debounceMs = DEBOUNCE_MS,
  placeholder, id, inputMode, autoComplete = 'off', className = 'input-field',
  emptyMessage = 'No matches. You can type it in yourself.',
  // Shown when the lookup itself failed rather than came back empty. Defaults to the same words,
  // since for most fields the distinction is invisible and the remedy is identical.
  errorMessage = emptyMessage,
}) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [spinner, setSpinner] = useState(false);
  // Distinct from `spinner`: this says a query finished and found nothing, which is what the
  // empty message is allowed to depend on. Without it the message would flash "no matches"
  // during the first keystrokes of every successful search.
  const [searched, setSearched] = useState(false);
  // The last lookup threw rather than returning nothing, which is a different thing to say.
  const [failed, setFailed] = useState(false);
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
    if (query.length < minChars) {
      setItems([]); setSpinner(false); setSearched(false); setFailed(false);
      return;
    }

    // Typing is faster than the round trip, so wait for a pause before asking. `cancelled` drops
    // the reply of any request the next keystroke has already made obsolete — without it a slow
    // response can land after a faster later one and show results for a stale query.
    let cancelled = false;
    let spinnerTimer;

    const timer = setTimeout(async () => {
      spinnerTimer = setTimeout(() => { if (!cancelled) setSpinner(true); }, SPINNER_DELAY_MS);
      try {
        const results = await fetchSuggestions(query);
        if (!cancelled) { setItems(results || []); setActive(-1); setSearched(true); setFailed(false); }
      } catch {
        if (!cancelled) { setItems([]); setSearched(true); setFailed(true); }
      } finally {
        clearTimeout(spinnerTimer);
        if (!cancelled) setSpinner(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(spinnerTimer);
    };
    // fetchSuggestions is rebuilt on every render by callers that close over sibling field
    // values; depending on it here would restart the search on each keystroke elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, open, minChars, debounceMs]);

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
    setSearched(false);
    setFailed(false);
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

  const longEnough = (value || '').trim().length >= minChars;
  const showEmpty = open && longEnough && searched && !items.length;
  const showList = open && (items.length > 0 || showEmpty);

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
        // Extra right padding only while the spinner is there, so it never sits on top of a long
        // city name; without the shift the text would slide under it mid-type.
        className={`${className}${spinner ? ' pr-10' : ''}`}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
      />

      {spinner && (
        <Loader2
          className="w-4 h-4 text-gray-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          role="status"
          aria-label="Searching"
        />
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

          {/* Says so out loud rather than letting the list vanish, which reads as a broken field
              when it is really just an address the register does not carry. */}
          {showEmpty && (
            <li className="px-3 py-2 text-sm text-gray-500">{failed ? errorMessage : emptyMessage}</li>
          )}
        </ul>
      )}
    </div>
  );
}
