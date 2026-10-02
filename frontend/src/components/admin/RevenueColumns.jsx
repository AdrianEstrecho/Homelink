import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatPrice } from '../../api/client';

// Monthly revenue as stacked columns, products under services, January through the current
// month — later months haven't happened, so they're left off rather than drawn as zeros, and
// the current month is marked MTD since it's still running. `data` rows are
// { month: 'YYYY-MM', revenue (products), services }.
export const SERIES = [
  { key: 'revenue', label: 'Products', color: '#2f5fae' },
  { key: 'services', label: 'Services', color: '#009a8b' },
];

const PAD = { left: 48, right: 8, top: 22, bottom: 26 };
const GAP = 2; // surface gap between stacked segments
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthName = (m) => MONTHS[Number(m.slice(5, 7)) - 1];

function compact(n) {
  if (n >= 1e6) return `₱${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `₱${Math.round(n / 1e3)}k`;
  return `₱${Math.round(n)}`;
}

// Round gridline spacing — 1, 2, 2.5 or 5 times a power of ten — picked so the tallest
// column fits under at most five gridlines; the axis tops out at the first line above it.
function niceScale(n) {
  if (n <= 0) return { step: 1, max: 1 };
  const pow = 10 ** Math.floor(Math.log10(n));
  const step = [0.1, 0.2, 0.25, 0.5, 1, 2].map(s => s * pow).find(s => Math.ceil(n / s) <= 5);
  return { step, max: Math.ceil(n / step) * step };
}

// A bar whose top corners are rounded (the end away from the baseline).
function topRoundedRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export default function RevenueColumns({ data, currentMonth }) {
  const [hover, setHover] = useState(null);
  const months = useMemo(() => data.filter(d => d.month <= currentMonth), [data, currentMonth]);
  const hasRevenue = months.some(d => d.revenue + (d.services || 0) > 0);

  // Drawn at the container's real pixel width (not a fixed viewBox scaled to fit), so axis
  // and month labels stay legible on a phone instead of shrinking with the drawing.
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(640);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasRevenue]);
  const height = width < 480 ? 200 : 240;

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const { step, max: maxY } = niceScale(Math.max(0, ...months.map(d => d.revenue + (d.services || 0))));
  const ticks = Array.from({ length: Math.round(maxY / step) + 1 }, (_, i) => i * step);
  const band = months.length ? plotW / months.length : plotW;
  const barW = Math.min(34, band * 0.58);
  const y = (v) => PAD.top + plotH - (v / maxY) * plotH;
  const hovered = hover !== null ? months[hover] : null;

  if (!hasRevenue) {
    return <p className="text-sm text-gray-400 py-16 text-center">No paid revenue yet this year.</p>;
  }

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="w-full h-auto block"
        role="img"
        aria-label={`Monthly revenue from products and services, January to ${monthName(currentMonth)}`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#d5dbe5' : '#eef1f5'} />
            <text x={PAD.left - 8} y={y(t) + 3} textAnchor="end" fontSize="10.5" fill="#8b96a8" style={{ fontVariantNumeric: 'tabular-nums' }}>{compact(t)}</text>
          </g>
        ))}

        {months.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          const x = cx - barW / 2;
          const products = d.revenue;
          const services = d.services || 0;
          const pTop = y(products);
          const pH = PAD.top + plotH - pTop;
          const sH = (services / maxY) * plotH;
          const sTop = pTop - sH - (products > 0 && services > 0 ? GAP : 0);
          const dim = hover !== null && hover !== i;
          const isCurrent = d.month === currentMonth;
          return (
            <g key={d.month} opacity={dim ? 0.4 : 1} style={{ transition: 'opacity 150ms' }}>
              {products > 0 && (
                <path d={services > 0 ? `M${x},${pTop} h${barW} v${pH} h${-barW} Z` : topRoundedRect(x, pTop, barW, pH, 4)} fill={SERIES[0].color} />
              )}
              {services > 0 && <path d={topRoundedRect(x, sTop, barW, sH, 4)} fill={SERIES[1].color} />}
              {isCurrent && (
                <text x={cx} y={(products + services > 0 ? Math.min(pTop, sTop) : PAD.top + plotH) - 6} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#6b7689" letterSpacing="0.06em">MTD</text>
              )}
              <text x={cx} y={height - 8} textAnchor="middle" fontSize="11" fill={hover === i ? '#14181f' : '#8b96a8'}>{monthName(d.month)}</text>
              {/* Hit target: the whole column band, much bigger than the bar. */}
              <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH + PAD.bottom} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div
          className="absolute top-0 pointer-events-none z-10 rounded-lg bg-brand-ink text-white text-xs px-3 py-2 shadow-lg min-w-[10.5rem]"
          style={{
            left: `${((PAD.left + band * hover + band / 2) / width) * 100}%`,
            transform: `translateX(${hover > months.length / 2 ? 'calc(-100% - 12px)' : '12px'})`,
          }}
        >
          <p className="font-semibold mb-1.5">{monthName(hovered.month)}{hovered.month === currentMonth ? ' · month to date' : ''}</p>
          {[...SERIES].reverse().map(s => (
            <p key={s.key} className="flex items-center gap-2 py-0.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
              <span className="text-white/70">{s.label}</span>
              <span className="ml-auto tabular-nums">{formatPrice(hovered[s.key] || 0)}</span>
            </p>
          ))}
          <p className="flex items-center gap-2 pt-1 mt-1 border-t border-white/15">
            <span className="text-white/70">Total</span>
            <span className="ml-auto tabular-nums font-semibold">{formatPrice(hovered.revenue + (hovered.services || 0))}</span>
          </p>
        </div>
      )}

      <table className="sr-only">
        <caption>Monthly revenue by source</caption>
        <thead><tr><th>Month</th>{SERIES.map(s => <th key={s.key}>{s.label}</th>)}<th>Total</th></tr></thead>
        <tbody>
          {months.map(d => (
            <tr key={d.month}>
              <td>{monthName(d.month)}</td>
              {SERIES.map(s => <td key={s.key}>{formatPrice(d[s.key] || 0)}</td>)}
              <td>{formatPrice(d.revenue + (d.services || 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
