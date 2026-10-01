import { Search, X, SlidersHorizontal } from 'lucide-react';

// The filter rail and search box shared by My Orders and My Bookings, so the two pages a customer
// reaches from their account read as one pair. Purely presentational: each page owns its own
// filter state (in the URL) and works out the counts — this only lays them out.

// Text search across whatever the page decides is searchable. type="search" for the mobile
// keyboard's search key; the browser's own clear button is hidden in favour of ours, which looks
// the same in every browser.
export function HistorySearch({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white/85 backdrop-blur-md pl-11 pr-11 py-3 text-sm text-brand-ink placeholder:text-gray-400 shadow-[0_2px_14px_-6px_rgba(15,43,91,0.14)] outline-none transition focus:border-brand-orange/50 focus:ring-2 focus:ring-brand-orange/25 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-brand-navy hover:bg-gray-100 transition"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// One titled list of options. A vertical list in the sidebar on a desktop; on a phone, where the
// rail sits above the results, the same buttons wrap into a sideways-scrolling row of chips so
// the filters don't push the first card below the fold.
function FilterGroup({ title, options, active, onSelect }) {
  return (
    <div>
      <p className="px-1 lg:px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">{title}</p>
      <div className="flex lg:flex-col gap-1.5 lg:gap-0.5 overflow-x-auto no-scrollbar">
        {options.map((o) => {
          const isActive = o.key === active;
          const Icon = o.icon;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onSelect(o.key)}
              aria-pressed={isActive}
              className={`group flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 lg:py-2.5 text-sm font-semibold whitespace-nowrap transition ${
                isActive
                  ? 'border-brand-navy bg-brand-navy text-white shadow-md shadow-brand-navy/20'
                  : 'border-gray-200 bg-white/70 text-gray-600 hover:border-brand-navy/20 hover:text-brand-navy lg:border-transparent lg:bg-transparent lg:hover:bg-white lg:hover:border-gray-100'
              }`}
            >
              {Icon && (
                <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-brand-orange' : 'text-gray-400 group-hover:text-brand-navy'}`} />
              )}
              <span className="lg:flex-1 text-left lg:truncate">{o.label}</span>
              {/* Zero still shows, but faded: the option stays reachable, it just says up front
                  that nothing is there under the other filters currently applied. */}
              <span
                className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold leading-none tabular-nums transition-colors ${
                  isActive ? 'bg-white/15 text-white' : o.count ? 'bg-gray-100 text-gray-500' : 'text-gray-300'
                }`}
              >
                {o.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// groups: [{ key, title, options: [{ key, label, icon, count }], active, onSelect }]
export function FilterSidebar({ groups, onReset }) {
  return (
    <aside className="card min-w-0 p-3 lg:p-4 space-y-4 lg:space-y-6 lg:sticky lg:top-28 lg:self-start" aria-label="Filters">
      <div className="flex items-center justify-between px-1 lg:px-3">
        <p className="flex items-center gap-2 font-display font-bold text-brand-ink">
          <SlidersHorizontal className="w-4 h-4 text-brand-orange" /> Filters
        </p>
        {onReset && (
          <button type="button" onClick={onReset} className="text-xs font-semibold text-brand-orange hover:underline">
            Reset
          </button>
        )}
      </div>
      {groups.map((g) => (
        <FilterGroup key={g.key} title={g.title} options={g.options} active={g.active} onSelect={g.onSelect} />
      ))}
    </aside>
  );
}

// Lower-cased, whitespace-split terms; every term has to appear somewhere in the haystack, so
// "daikin split" finds the Daikin split-type unit and not every split-type on file. A leading '#'
// is dropped so a reference pasted from an email ("#A1B2C3D4") matches the bare one.
export function searchTerms(query) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean).map((t) => t.replace(/^#/, '')).filter(Boolean);
}

export function matchesTerms(haystack, terms) {
  if (terms.length === 0) return true;
  const text = haystack.filter(Boolean).join(' ').toLowerCase();
  return terms.every((t) => text.includes(t));
}
