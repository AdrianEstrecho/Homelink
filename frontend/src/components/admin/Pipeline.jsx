import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';

// One fulfillment track: the stages an order or booking moves through, in order, each a tile
// with how many sit there now and their share of the track, opening that status's list.
// The in-progress stage holding the most is tagged "Most waiting" — that's the backlog to
// work on. `stages` are { key, label, icon, count, to }; the last stage is "done", so it's
// never the backlog. `offTrack` (cancelled) is counted in the header, not as a step, since
// nothing moves on from there. `color` is the business line's series color.
export default function Pipeline({ title, color, stages, offTrack, to, linkLabel }) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const inProgress = stages.slice(0, -1);
  const inProgressCount = inProgress.reduce((sum, s) => sum + s.count, 0);
  const busiest = inProgress.reduce((top, s) => (s.count > (top?.count ?? 0) ? s : top), null);

  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
        <h4 className="flex items-center gap-2 font-semibold text-gray-900">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
          {title}
        </h4>
        <p className="text-xs text-gray-500">
          <span className="font-semibold text-gray-900">{inProgressCount.toLocaleString()}</span> in progress
          {offTrack && <> · <span className="font-semibold text-gray-700">{offTrack.count.toLocaleString()}</span> {offTrack.label}</>}
        </p>
        {to && (
          <Link to={to} className="ml-auto text-xs font-semibold text-brand-navy hover:text-brand-orange transition inline-flex items-center gap-1">
            {linkLabel} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      <ol className="grid grid-cols-2 gap-3 sm:flex sm:items-stretch sm:gap-0">
        {stages.map((s, i) => {
          const last = i === stages.length - 1;
          const isBusiest = s === busiest;
          const pct = total ? Math.round((s.count / total) * 100) : 0;
          const Icon = s.icon;
          return (
            <li key={s.key} className="flex min-w-0 sm:flex-1 sm:items-center">
              <Link
                to={s.to}
                className={`group flex-1 min-w-0 rounded-xl border p-3.5 sm:p-4 transition ${
                  isBusiest
                    ? 'border-[#ffd8c6] bg-[#fffaf7] hover:border-[#ffb796]'
                    : 'border-[#e8ecf2] bg-white hover:border-brand-navy/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2 min-h-[1.375rem]">
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={last ? { background: color, color: '#fff' } : { background: `${color}14`, color }}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
                  </span>
                  {isBusiest && (
                    <span className="truncate rounded-md bg-[#fff1ea] px-1.5 py-0.5 text-[11px] font-semibold text-[#b9461b]">Most waiting</span>
                  )}
                </div>
                <p className="mt-3 text-2xl font-semibold leading-none tracking-tight text-brand-ink">{s.count.toLocaleString()}</p>
                <p className="mt-1.5 text-sm text-gray-600 truncate group-hover:text-brand-navy transition">{s.label}</p>
                <div className="mt-3 flex items-center gap-2" title={`${pct}% of ${title.toLowerCase()} on this track`}>
                  <span className="relative h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </span>
                  <span className="w-8 text-right text-xs tabular-nums text-gray-400">{pct}%</span>
                </div>
              </Link>
              {/* Points on to the next stage — sm and up, where the tiles sit in one row. */}
              {!last && (
                <span className="hidden sm:flex shrink-0 w-7 justify-center text-gray-300" aria-hidden="true">
                  <ChevronRight className="w-4 h-4" />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
