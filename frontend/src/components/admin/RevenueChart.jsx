import { useMemo, useState } from 'react';
import { formatPrice } from '../../api/client';

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 26;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatCompact(n) {
  if (n >= 1000) return `₱${Math.round(n / 1000)}k`;
  return `₱${Math.round(n)}`;
}

export default function RevenueChart({ data }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const { points, maxY, linePath, areaPath } = useMemo(() => {
    const max = Math.max(1, ...data.map(d => d.revenue));
    const pts = data.map((d, i) => {
      const x = PAD_LEFT + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
      const y = PAD_TOP + plotH - (d.revenue / max) * plotH;
      return { x, y, ...d };
    });
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area = pts.length
      ? `M ${pts[0].x.toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} ` +
        pts.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
        ` L ${pts[pts.length - 1].x.toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} Z`
      : '';
    return { points: pts, maxY: max, linePath: line, areaPath: area };
  }, [data, plotW, plotH]);

  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const colWidth = points.length ? WIDTH / points.length : WIDTH;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto block" role="img" aria-label="Monthly revenue for the current year">
        {gridSteps.map(g => {
          const y = PAD_TOP + plotH * (1 - g);
          return (
            <g key={g}>
              <line x1={PAD_LEFT} y1={y} x2={WIDTH - PAD_RIGHT} y2={y} stroke="#e5e9f0" strokeWidth="1" />
              <text x={PAD_LEFT - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#9aa6b8">{formatCompact(maxY * g)}</text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill="#00806f" opacity="0.08" />}
        {linePath && <path d={linePath} fill="none" stroke="#00806f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}

        {points.map((p, i) => (
          <g key={p.month}>
            {i === points.length - 1 && hoverIndex === null && (
              <circle cx={p.x} cy={p.y} r="4" fill="#00806f" stroke="white" strokeWidth="2" />
            )}
            {hoverIndex === i && (
              <>
                <line x1={p.x} y1={PAD_TOP} x2={p.x} y2={PAD_TOP + plotH} stroke="#00806f" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
                <circle cx={p.x} cy={p.y} r="5" fill="#00806f" stroke="white" strokeWidth="2" />
              </>
            )}
            <text x={p.x} y={HEIGHT - 8} textAnchor="middle" fontSize="9" fill="#9aa6b8">{MONTH_LABELS[Number(p.month.slice(5, 7)) - 1]}</text>
            <rect
              x={p.x - colWidth / 2}
              y={PAD_TOP}
              width={colWidth}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          </g>
        ))}
      </svg>
      {hovered && (
        <div
          className="absolute pointer-events-none bg-brand-navy text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg -translate-x-1/2"
          style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: `${(hovered.y / HEIGHT) * 100}%`, marginTop: '-40px' }}
        >
          <p className="font-semibold whitespace-nowrap">{formatPrice(hovered.revenue)}</p>
          <p className="text-gray-300">{MONTH_LABELS[Number(hovered.month.slice(5, 7)) - 1]}</p>
        </div>
      )}
    </div>
  );
}
