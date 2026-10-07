// HomeLink's mark: a house with a wrench swept in beneath it, traced from the brand artwork.
// The house is drawn in currentColor so the mark sits on light surfaces (navy) and dark ones
// (white) alike; the wrench is always brand orange. public/favicon.svg carries the same paths.
export const MARK_VIEWBOX = '0 0 190 162';
export const HOUSE_PATH =
  'M3 79.88L94.92 7.5Q100 2.9 105.08 7.5L148 41.3L148 26L171.5 26L171.5 59.8L187 72L187 105.1L100 32.6L46 75.12L46 118L99 118L41.25 156.5L39 156.5A20 20 0 0 1 19 136.5L19 89L3 89Z';
export const WRENCH_PATH =
  'M51 157.43L146.28 157.43A33.63 33.63 0 0 0 179.45 118.27L156.63 129.69A12.52 12.52 0 0 1 145.43 107.29L166.36 96.82A33.63 33.63 0 0 0 113.34 117Z';
const PANES = [[79, 63.5], [98.5, 63.5], [79, 83], [98.5, 83]];
// Centre of the jaw (the bolt it would be turning), which .logo-wrench rotates about.
const WRENCH_PIVOT = '151px 118.5px';

// The mark's shapes on their own, for drawing it inside another SVG (e.g. on the side of a
// truck). `house` and `wrench` are fills.
export function LogoGlyph({ house = 'currentColor', wrench = '#ff6b35' }) {
  return (
    <>
      {/* A same-colour stroke with round joins softens every corner, as in the artwork. */}
      <path d={HOUSE_PATH} fill={house} stroke={house} strokeWidth="2" strokeLinejoin="round" />
      {PANES.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="15.5" height="15.5" rx="1.2" fill={house} />
      ))}
      <path
        d={WRENCH_PATH}
        fill={wrench}
        stroke={wrench}
        strokeWidth="2"
        strokeLinejoin="round"
        className="logo-wrench"
        style={{ transformOrigin: WRENCH_PIVOT }}
      />
    </>
  );
}

// Size it with a width class; the height follows the artwork's proportions. Pass
// wrench="currentColor" for a one-colour mark, e.g. on a backdrop that may itself be orange.
export function LogoMark({ className = '', wrench }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={`block h-auto shrink-0 overflow-visible ${className}`} aria-hidden="true">
      <LogoGlyph wrench={wrench} />
    </svg>
  );
}

// Mark plus wordmark. `tone` is the colour of the house and "Home": 'navy' on light surfaces,
// 'white' on dark ones. Inside a `group`, hovering it gives the wrench a turn.
export default function Logo({ tone = 'navy', className = '', markClassName = 'w-10', textClassName = 'text-xl' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 transition-colors ${tone === 'white' ? 'text-white' : 'text-brand-navy'} ${className}`}>
      <LogoMark className={markClassName} />
      <span className={`font-display font-extrabold tracking-tight leading-none ${textClassName}`}>
        Home<span className="text-brand-orange">Link</span>
      </span>
    </span>
  );
}
