// Front elevation of a house in blueprint line work, for the Account header (see .blueprint-sheet
// in index.css). Decorative only. Each stroke draws itself in turn via .bp-line — ground, roof,
// walls, then the openings — and the redline dimensions and drawing title fade in once the house
// is up. viewBox units are 1:1 with CSS pixels at the default width, so the title's 11px
// .drafting-label lettering matches the labels around it.
const HOUSE = [
  ['M8 148H272', 0],
  ['M36 90L140 26L244 90', 180],
  ['M36 90H244', 420],
  ['M60 90V148M220 90V148', 520],
  ['M186 54V36H202V64', 700],
  ['M128 148V112H152V148', 780],
  ['M78 102H110V126H78ZM94 102V126M78 114H110', 860],
  ['M170 102H202V126H170ZM186 102V126M170 114H202', 940],
  ['M133 64a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 1020],
];

const DIMENSIONS = [
  'M60 152V168M220 152V168M60 162H220M56 166L64 158M216 166L224 158',
  'M150 26H264M226 148H264M258 26V148M254 30L262 22M254 152L262 144',
];

export default function BlueprintHouse({ title, className = '' }) {
  return (
    <svg viewBox="0 0 280 186" width="280" height="186" fill="none" aria-hidden="true" className={className}>
      <g stroke="rgba(255,255,255,0.6)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        {HOUSE.map(([d, delay]) => (
          <path key={d} d={d} pathLength="1" className="bp-line" style={{ '--d': `${delay}ms` }} />
        ))}
      </g>
      <g stroke="#ff6b35" strokeOpacity="0.85" strokeWidth="1" strokeLinecap="round" className="bp-fade" style={{ '--d': '1200ms' }}>
        {DIMENSIONS.map(d => <path key={d} d={d} />)}
      </g>
      <text
        x="140" y="183" textAnchor="middle" fill="rgba(255,255,255,0.7)"
        className="drafting-label bp-fade" style={{ '--d': '1400ms' }}
      >
        {title}
      </text>
    </svg>
  );
}
