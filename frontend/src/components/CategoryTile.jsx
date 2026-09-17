import { ArrowRight } from 'lucide-react';

// "1 item" / "13 items" — meta line text for a tile.
export function countLabel(count, noun) {
  const n = Number(count) || 0;
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

// Category card shared by the homepage's "Shop by category" grid and the
// Products / Services filter rows. On hover the card lifts, its icon tile
// fills orange and tilts, and the meta line (e.g. "13 items") slides up to
// reveal the action label. `active` keeps the tile filled for the selected
// filter. Renders a <button> by default; pass `as={Link}` plus `to` for a link.
export default function CategoryTile({ as: Tag = 'button', icon: Icon, label, meta, action, active = false, className = '', ...props }) {
  const buttonProps = Tag === 'button' ? { type: 'button', 'aria-pressed': active } : {};

  return (
    <Tag
      {...buttonProps}
      {...props}
      className={`card group h-full w-full flex flex-col items-center text-center p-3 sm:p-4 gap-2 sm:gap-3 hover:-translate-y-1.5 hover:shadow-[0_18px_40px_-16px_rgba(15,43,91,0.35)] ${
        active ? 'border-brand-orange/50 ring-1 ring-brand-orange/20' : 'hover:border-brand-orange/40'
      } ${className}`}
    >
      <div
        className={`w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
          active
            ? 'bg-brand-orange shadow-lg shadow-brand-orange/30'
            : 'bg-brand-navy/5 group-hover:bg-brand-orange group-hover:-rotate-6 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-brand-orange/30'
        }`}
      >
        <Icon className={`w-5 h-5 sm:w-7 sm:h-7 transition-colors duration-300 ${active ? 'text-white' : 'text-brand-navy group-hover:text-white'}`} />
      </div>
      <h3 className={`text-xs sm:text-sm leading-tight ${active ? 'font-semibold text-brand-navy' : 'font-medium text-gray-800'}`}>{label}</h3>
      {meta != null && (
        <div className="relative h-4 w-full overflow-hidden text-[11px] mt-auto">
          <span className="absolute inset-x-0 top-0 text-gray-400 transition-transform duration-300 group-hover:-translate-y-full">
            {meta}
          </span>
          <span className="absolute inset-x-0 top-0 translate-y-full font-semibold text-brand-orange inline-flex items-center justify-center gap-0.5 transition-transform duration-300 group-hover:translate-y-0">
            {action} <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      )}
    </Tag>
  );
}
