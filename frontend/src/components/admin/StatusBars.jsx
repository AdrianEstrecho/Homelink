// Order counts per status as thin bars: a swatch, the status in ink, its count and share.
// The fills match each status's badge color elsewhere in the admin; the text never takes
// the fill color, so it stays readable for every status.
const STATUS_FILL = {
  pending: 'bg-yellow-400',
  processing: 'bg-blue-400',
  shipped: 'bg-purple-400',
  delivered: 'bg-green-400',
  cancelled: 'bg-red-400',
};

export default function StatusBars({ rows, total }) {
  const denominator = total || 1;
  return (
    <div className="space-y-4">
      {rows.map(r => {
        const pct = Math.round((r.count / denominator) * 100);
        const fill = STATUS_FILL[r.status] || 'bg-gray-400';
        return (
          <div key={r.status}>
            <div className="flex items-center gap-2 text-sm mb-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${fill}`} />
              <span className="capitalize font-medium text-gray-700">{r.status}</span>
              <span className="ml-auto tabular-nums text-gray-900 font-medium">{r.count.toLocaleString()}</span>
              <span className="w-9 text-right tabular-nums text-xs text-gray-400">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
