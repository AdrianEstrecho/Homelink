import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// One headline number on a dashboard. `tone="alert"` is for a count that needs someone to act
// (low stock, unassigned jobs): it warms the tile and, with `to`, links straight to the fix —
// `action` names that link. The value stays in ink in every tone; the icon and tint carry
// the state, never the number's color.
export default function StatTile({ label, value, icon: Icon, tone = 'default', to, action, className: extraClass = '' }) {
  const alert = tone === 'alert';
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm ${alert ? 'text-[#a2401a] font-medium' : 'text-gray-500'}`}>{label}</p>
        {Icon && (
          <span className={`w-9 h-9 -mt-1 -mr-1 rounded-lg flex items-center justify-center shrink-0 ${alert ? 'bg-brand-orange/15 text-[#c8461a]' : 'bg-brand-navy/[0.06] text-brand-navy'}`}>
            <Icon className="w-[18px] h-[18px]" />
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl sm:text-[1.75rem] leading-tight font-semibold tracking-tight text-brand-ink">{value}</p>
      {to && action && (
        <p className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${alert ? 'text-[#c8461a]' : 'text-brand-navy'}`}>
          {action} <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
        </p>
      )}
    </>
  );

  const className = `group block rounded-2xl border p-4 sm:p-5 transition ${
    alert
      ? 'bg-[#fff6f1] border-[#ffd8c6]'
      : 'bg-white border-[#e4e8f0] shadow-[0_1px_2px_rgba(15,43,91,0.04)]'
  } ${to ? (alert ? 'hover:border-[#ffb796]' : 'hover:border-brand-navy/25') : ''} ${extraClass}`;

  return to ? <Link to={to} className={className}>{body}</Link> : <div className={className}>{body}</div>;
}
