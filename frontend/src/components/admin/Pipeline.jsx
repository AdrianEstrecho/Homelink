import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';

// One fulfillment track: the stages an order or booking moves through, in order, with how
// many sit at each right now. The last stage is the finish line (filled node with a check);
// `offTrack` (e.g. cancelled) is counted beside the track rather than as a step on it, since
// nothing moves on from there. `color` is the business line's series color.
export default function Pipeline({ title, color, stages, offTrack, to, linkLabel }) {
  const inProgress = stages.slice(0, -1).reduce((sum, s) => sum + s.count, 0);
  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-5">
        <h4 className="flex items-center gap-2 font-semibold text-gray-900">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
          {title}
        </h4>
        <p className="text-xs text-gray-500"><span className="font-semibold text-gray-900 tabular-nums">{inProgress.toLocaleString()}</span> in progress</p>
        {to && (
          <Link to={to} className="ml-auto text-xs font-semibold text-brand-navy hover:text-brand-orange transition inline-flex items-center gap-1">
            {linkLabel} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      <ol className="grid" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
        {stages.map((s, i) => {
          const last = i === stages.length - 1;
          return (
            <li key={s.key} className="relative pr-2">
              {/* The track between this stage and the next. */}
              {!last && <span className="absolute left-3.5 right-0 top-[13px] h-0.5 rounded-full" style={{ background: `${color}33` }} aria-hidden="true" />}
              <span
                className="relative z-[1] flex items-center justify-center w-7 h-7 rounded-full border-2 bg-white"
                style={last ? { background: color, borderColor: color } : { borderColor: color }}
                aria-hidden="true"
              >
                {last ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} /> : <span className="w-2 h-2 rounded-full" style={{ background: s.count > 0 ? color : 'transparent' }} />}
              </span>
              <p className="mt-2.5 text-xs text-gray-500 truncate">{s.label}</p>
              <p className="text-xl font-semibold text-brand-ink leading-tight">{s.count.toLocaleString()}</p>
            </li>
          );
        })}
      </ol>

      {offTrack && (
        <p className="mt-4 text-xs text-gray-500">
          <span className="font-semibold text-gray-700 tabular-nums">{offTrack.count.toLocaleString()}</span> {offTrack.label}
        </p>
      )}
    </section>
  );
}
