import { useId } from 'react';

// The night-sky house beside every auth form — same sky gradient as the homepage
// hero (.hero-pin), so signing in reads as stepping into the same world. Its
// windows light up one by one as `level` (0–1) rises; pages map their own form
// progress onto it (see Login.jsx / Register.jsx). `success` lights everything
// and pulses the signal above the roof; bumping `flickerKey` makes the lit
// windows flicker once, for a failed attempt.

// In switch-on order. Coordinates are in the SVG's 400x300 viewBox:
// panes are [x, y, w, h], mullions [x1, y1, x2, y2], glow [cx, cy, rx, ry].
const LIGHTS = [
  { key: 'porch', panes: [[198, 220, 14, 16]], lamp: [230, 222], glow: [212, 230, 36, 30] },
  { key: 'living', panes: [[124, 214, 48, 34]], mullions: [[148, 214, 148, 248], [124, 231, 172, 231]], glow: [148, 231, 50, 38] },
  { key: 'bedroom', panes: [[128, 164, 34, 32]], mullions: [[145, 164, 145, 196]], glow: [145, 180, 38, 34] },
  { key: 'study', panes: [[208, 164, 34, 32]], mullions: [[225, 164, 225, 196]], glow: [225, 180, 38, 34] },
  { key: 'garage', panes: [[282, 216, 46, 26]], mullions: [[305, 216, 305, 242]], glow: [305, 229, 42, 30] },
  { key: 'attic', circle: [185, 128, 9], glow: [185, 128, 26, 24] },
];

// Placed in % of the panel rather than inside the SVG, so they cover the whole
// sky at any aspect ratio (the house itself is letterboxed to the bottom edge).
// Fixed values, not Math.random(), so they don't jump around on re-render.
// [left %, top %, size px, twinkle delay s]
const STARS = [
  [7, 9, 2, 0], [15, 30, 1.5, 1.4], [24, 14, 1.5, 2.6], [33, 6, 2, 0.8], [41, 24, 1, 3.1],
  [52, 11, 1.5, 1.9], [60, 31, 2, 0.3], [71, 7, 1, 2.2], [84, 36, 1.5, 3.6], [92, 18, 2, 1.1],
  [11, 44, 1, 2.9], [47, 40, 1.5, 0.6], [66, 46, 1, 3.3], [29, 52, 1.5, 1.6], [95, 50, 1, 2.4],
];

const WALL = '#10275a';
const WING = '#0d2352';
const TRIM = '#081735';
const PANE_OFF = '#1a3872';

function Light({ light, on, glowFill, paneFill }) {
  const { panes = [], mullions = [], circle, lamp, glow } = light;
  const onStyle = { opacity: on ? 1 : 0 };
  return (
    <g>
      <ellipse cx={glow[0]} cy={glow[1]} rx={glow[2]} ry={glow[3]} fill={glowFill} className="auth-light" style={onStyle} />
      {panes.map(([x, y, w, h]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width={w} height={h} rx="1.5" fill={PANE_OFF} />
          <rect x={x} y={y} width={w} height={h} rx="1.5" fill={paneFill} className="auth-light" style={onStyle} />
        </g>
      ))}
      {circle && (
        <>
          <circle cx={circle[0]} cy={circle[1]} r={circle[2]} fill={PANE_OFF} />
          <circle cx={circle[0]} cy={circle[1]} r={circle[2]} fill={paneFill} className="auth-light" style={onStyle} />
          <line x1={circle[0] - circle[2]} y1={circle[1]} x2={circle[0] + circle[2]} y2={circle[1]} stroke={TRIM} strokeWidth="2" />
        </>
      )}
      {mullions.map(([x1, y1, x2, y2]) => (
        <line key={`${x1}-${y1}-${x2}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={WALL} strokeWidth="2" />
      ))}
      {lamp && (
        <>
          <circle cx={lamp[0]} cy={lamp[1]} r="2.5" fill={TRIM} />
          <circle cx={lamp[0]} cy={lamp[1]} r="2.5" fill="#ffe3a8" className="auth-light" style={onStyle} />
        </>
      )}
    </g>
  );
}

export default function AuthScene({ level = 0, success = false, flickerKey = 0, compact = false, className = 'relative' }) {
  // useId() returns ":r0:"-style ids, and the colons break url(#…) references.
  const uid = useId().replace(/:/g, '');
  const ids = { glow: `${uid}-glow`, pane: `${uid}-pane`, halo: `${uid}-halo` };

  const clamped = Math.min(Math.max(level, 0), 1);
  // The epsilon keeps float error (e.g. 5/6 * 6 = 4.999…) from dropping a light.
  const lit = success ? LIGHTS.length : Math.floor(clamped * LIGHTS.length + 1e-6);

  return (
    <div className={`auth-sky overflow-hidden ${className}`} aria-hidden="true">
      <div className={`auth-moon ${compact ? 'auth-moon--compact' : ''}`} />
      {STARS.slice(0, compact ? 9 : STARS.length).map(([left, top, size, delay]) => (
        <span
          key={`${left}-${top}`}
          className="auth-star"
          style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${delay}s` }}
        />
      ))}

      <svg
        viewBox={compact ? '60 50 320 222' : '0 0 400 300'}
        preserveAspectRatio="xMidYMax meet"
        className={`absolute inset-x-0 bottom-0 w-full ${compact ? 'h-[94%]' : 'h-[74%]'}`}
      >
        <defs>
          <radialGradient id={ids.glow}>
            <stop offset="0%" stopColor="#ffb070" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#ff8a4c" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#ff6b35" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={ids.pane} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffe6ae" />
            <stop offset="100%" stopColor="#ffb35c" />
          </linearGradient>
          <radialGradient id={ids.halo}>
            <stop offset="0%" stopColor="#ff9a5a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ff6b35" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Warm haze behind the house that builds with each light that's on. */}
        <ellipse
          cx="210" cy="200" rx="200" ry="120"
          fill={`url(#${ids.halo})`}
          className="auth-light"
          style={{ opacity: success ? 1 : (lit / LIGHTS.length) * 0.7 }}
        />

        {/* Ground runs far past the viewBox so it reaches both edges of any panel width. */}
        <rect x="-2000" y="262" width="4400" height="2000" fill="#071430" />
        <path d="M192 266 H218 L236 300 H174 Z" fill="#0b1d44" />

        {/* Chimney sits behind the roof so the roof hides its base. */}
        <rect x="226" y="100" width="16" height="36" fill={TRIM} />
        <rect x="223" y="96" width="22" height="6" rx="1" fill={TRIM} />

        <polygon points="260,184 348,198 348,262 260,262" fill={WING} />
        <polygon points="254,178 354,194 354,201 254,185" fill={TRIM} />

        <rect x="110" y="150" width="150" height="112" fill={WALL} />
        <polygon points="98,154 185,88 272,154" fill={TRIM} />
        <rect x="110" y="202" width="150" height="3" fill={WING} />

        {/* Sills */}
        <rect x="125" y="196" width="40" height="4" rx="1" fill={TRIM} />
        <rect x="205" y="196" width="40" height="4" rx="1" fill={TRIM} />
        <rect x="121" y="248" width="54" height="4" rx="1" fill={TRIM} />
        <rect x="279" y="242" width="52" height="4" rx="1" fill={TRIM} />

        {/* Door, awning and step */}
        <rect x="190" y="212" width="30" height="50" rx="1.5" fill={TRIM} />
        <rect x="184" y="206" width="42" height="5" rx="1" fill={TRIM} />
        <rect x="186" y="262" width="38" height="4" fill={TRIM} />

        <g key={flickerKey} className={flickerKey ? 'auth-lights-flicker' : undefined}>
          {LIGHTS.map((light, i) => (
            <Light
              key={light.key}
              light={light}
              on={i < lit}
              glowFill={`url(#${ids.glow})`}
              paneFill={`url(#${ids.pane})`}
            />
          ))}
        </g>

        {/* Shrubs in front of the walls */}
        <circle cx="104" cy="258" r="11" fill="#0a1b3d" />
        <circle cx="93" cy="263" r="8" fill="#0a1b3d" />
        <circle cx="352" cy="257" r="10" fill="#0a1b3d" />
        <circle cx="363" cy="263" r="7" fill="#0a1b3d" />

        {/* The "link" in HomeLink — only broadcasts once you're in. */}
        <g className="auth-signal" data-on={success}>
          <path d="M177.9 72.9 A10 10 0 0 1 192.1 72.9" />
          <path d="M170.9 65.9 A20 20 0 0 1 199.1 65.9" />
          <path d="M163.8 58.8 A30 30 0 0 1 206.2 58.8" />
          <circle cx="185" cy="80" r="2.5" />
        </g>
      </svg>
    </div>
  );
}
