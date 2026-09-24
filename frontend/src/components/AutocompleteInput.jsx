import { useEffect, useId, useRef, useState } from 'react';

// How long to sit on a keystroke before asking. Long enough that typing a whole word costs one
// request, short enough that a pause feels answered immediately. Fields that cross the network
// raise it (see the street field): when the answer itself takes over a second, waiting a little
// longer to ask costs nothing perceptible and spares a run of requests nobody waits for.
const DEBOUNCE_MS = 180;

// A loading state is only honest once there is a real wait. Province, city and barangay come out
// of an in-memory index in a few milliseconds, so showing one on every keystroke is pure flicker:
// it would appear and vanish faster than it could be read, and make an instant field look busy.
// Nothing is shown until a lookup has been outstanding this long, which in practice means only
// the street field ever reaches it — it is the one that crosses the network to a geocoder.
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

    // Timed from the keystroke rather than from when the request finally goes out. Started after
    // the debounce instead, the street field would wait out its own 400ms pause and then a
    // further 400ms before admitting to anything — the better part of a second of a field that
    // looks like it ignored you. Measured from the keystroke, the promise is the same everywhere:
    // nothing is said for 400ms, and after that the wait is always acknowledged.
    const spinnerTimer = setTimeout(() => { if (!cancelled) setSpinner(true); }, SPINNER_DELAY_MS);

    const timer = setTimeout(async () => {
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
  const showEmpty = open && longEnough && searched && !items.length && !spinner;
  // The dropdown has to open on `spinner` too. Without it the first search on a field shows
  // nothing at all — no results yet, and `searched` is still false, so there is no empty message
  // either — which on the street field means several seconds of a form that looks inert.
  const showList = open && (items.length > 0 || showEmpty || spinner);
  const showSkeletons = spinner && !items.length;

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
        // No loading state is painted into the input itself. Padding that appears with a spinner
        // shoves the text sideways mid-keystroke, and padding reserved permanently narrows every
        // field for the sake of an indicator that is almost never showing. The dropdown below is
        // already anchored under the field and has room to say it properly.
        className={className}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
      />

      {showList && (
        // Two boxes rather than one. The bar belongs to the outer, unscrolled frame, so it stays
        // pinned at the top while the list moves under it — and, more to the point, the scroll
        // container is never switched between auto and hidden. Toggling that on a list long
        // enough to scroll takes the scrollbar away and puts it back on every refresh, and every
        // row shifts sideways underneath the cursor.
        <div
          className={`absolute z-30 left-0 right-0 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden ${
            spinner && items.length ? 'loading-bar' : ''
          }`}
        >
          <ul
            id={listId}
            role="listbox"
            aria-busy={spinner}
            className="max-h-60 overflow-auto py-1"
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

            {/* Two bars per row, mirroring the name and the parent names a real suggestion
                carries, and of staggered width so the block reads as pending content rather than
                a loading graphic. Three is a guess at the result count, so the dropdown still
                resizes when the real ones arrive — the shape is what stays put, not the height. */}
            {showSkeletons && [0, 1, 2].map(i => (
              <li key={`skeleton-${i}`} className="px-3 py-2" aria-hidden="true">
                <span className="skeleton block h-3.5 rounded" style={{ width: `${70 - i * 12}%` }} />
                <span className="skeleton block h-2.5 rounded mt-1.5" style={{ width: `${50 - i * 8}%` }} />
              </li>
            ))}
            {/* The skeletons are decorative, so the wait is announced in words instead. */}
            {showSkeletons && <li className="sr-only" role="status">Searching</li>}

            {/* Says so out loud rather than letting the list vanish, which reads as a broken field
                when it is really just an address the register does not carry. */}
            {showEmpty && (
              <li className="px-3 py-2 text-sm text-gray-500">{failed ? errorMessage : emptyMessage}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
