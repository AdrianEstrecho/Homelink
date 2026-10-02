// A status/segment filter above an admin table. `count` (optional) shows as a badge.
export default function FilterTab({ active, onClick, count, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
        active
          ? 'bg-brand-navy border-brand-navy text-white shadow-[0_2px_8px_-2px_rgba(15,43,91,0.35)]'
          : 'bg-white border-[#e4e8f0] text-gray-600 hover:border-brand-navy/25 hover:text-brand-navy'
      }`}
    >
      {children}
      {count != null && (
        <span className={`min-w-[1.375rem] px-1.5 py-px rounded-md text-xs font-semibold tabular-nums text-center ${active ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}
