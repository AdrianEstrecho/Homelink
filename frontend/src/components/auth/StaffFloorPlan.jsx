import { useId } from 'react';
import { STAFF_ROLES } from '../../constants/staffRoles';

// The staff portal's floor plan: HomeLink's HQ drawn as a blueprint, one room per staff
// role. `activeKey` lights that room (the role being previewed or signed in to) and dims
// the rest; `success` lights every room in turn; bumping `flickerKey` makes the lit room
// stutter once, for a failed attempt — the same language as the customer AuthScene's
// windows. With `interactive`, hovering or clicking a room previews or picks its role.
// Mouse-only and aria-hidden: the role list beside it is the accessible control.

// viewBox units per metre — room dimensions and the scale bar are read off this.
const UNIT = 40;

// Rooms, keyed by role. [x, y] places the room's name; furniture is drawn per room below.
const ROOMS = {
  admin: { x: 40, y: 40, w: 220, h: 160, label: [150, 172] },
  hr: { x: 260, y: 40, w: 160, h: 160, label: [352, 166] },
  booking_coordinator: { x: 420, y: 40, w: 180, h: 160, label: [478, 112] },
  inventory_clerk: { x: 40, y: 200, w: 120, h: 200, label: [100, 300] },
  general_staff: { x: 160, y: 240, w: 200, h: 160, label: [320, 366] },
  installer: { x: 360, y: 240, w: 240, h: 160, label: [436, 304] },
};

// Clockwise from the head office, the order rooms light up on a successful sign-in.
const LIGHT_ORDER = ['admin', 'hr', 'booking_coordinator', 'installer', 'general_staff', 'inventory_clerk'];

// [x1, y1, x2, y2, openings] — openings are [from, to] gaps along the wall for doors and windows.
// Exterior runs reach 3 units past each corner so the 6-unit walls meet square.
const EXTERIOR_WALLS = [
  [37, 40, 603, 40, [[80, 200], [300, 380], [460, 560]]],
  [37, 400, 603, 400, [[70, 130], [240, 280], [395, 565]]],
  [40, 37, 40, 403, [[80, 160]]],
  [600, 37, 600, 403, [[80, 160]]],
];
const INTERIOR_WALLS = [
  [40, 200, 600, 200, [[222, 252], [268, 298], [470, 500]]],
  [160, 240, 600, 240, [[245, 275], [400, 430]]],
  [160, 200, 160, 400, [[205, 235]]],
  [260, 40, 260, 200, []],
  [420, 40, 420, 200, []],
  [360, 240, 360, 400, []],
];
// [axis, position along the other axis, from, to]
const WINDOWS = [
  ['h', 40, 80, 200], ['h', 40, 300, 380], ['h', 40, 460, 560], ['h', 400, 70, 130],
  ['v', 40, 80, 160], ['v', 600, 80, 160],
];
// Door leaf plus its swing arc.
const DOORS = [
  'M252 200 V170 A30 30 0 0 0 222 200',
  'M268 200 V170 A30 30 0 0 1 298 200',
  'M470 200 V170 A30 30 0 0 1 500 200',
  'M160 205 H130 A30 30 0 0 0 160 235',
  'M245 240 V270 A30 30 0 0 0 275 240',
  'M430 240 V270 A30 30 0 0 1 400 240',
  // Front entrance, double doors.
  'M240 400 V380 A20 20 0 0 1 260 400',
  'M280 400 V380 A20 20 0 0 0 260 400',
];

function segments([x1, y1, x2, y2, openings]) {
  const horizontal = y1 === y2;
  const [start, end] = horizontal ? [x1, x2] : [y1, y2];
  const runs = [];
  let from = start;
  for (const [a, b] of openings) {
    runs.push([from, a]);
    from = b;
  }
  runs.push([from, end]);
  return runs.map(([a, b]) => (horizontal ? `M${a} ${y1} H${b}` : `M${x1} ${a} V${b}`)).join(' ');
}

function windowPath([axis, at, a, b]) {
  if (axis === 'h') return `M${a} ${at - 3} H${b} M${a} ${at} H${b} M${a} ${at + 3} H${b} M${a} ${at - 3} V${at + 3} M${b} ${at - 3} V${at + 3}`;
  return `M${at - 3} ${a} V${b} M${at} ${a} V${b} M${at + 3} ${a} V${b} M${at - 3} ${a} H${at + 3} M${at - 3} ${b} H${at + 3}`;
}

// Enough of each room's fit-out to tell them apart at a glance.
const FURNITURE = {
  admin: (
    <>
      <rect x="105" y="86" width="90" height="34" rx="2" />
      <circle cx="150" cy="70" r="9" />
      <rect x="124" y="130" width="16" height="14" rx="3" />
      <rect x="160" y="130" width="16" height="14" rx="3" />
      <circle cx="232" cy="68" r="10" />
      <circle cx="232" cy="68" r="4" />
    </>
  ),
  hr: (
    <>
      <rect x="300" y="82" width="64" height="28" rx="2" />
      <circle cx="332" cy="68" r="8" />
      <rect x="308" y="122" width="14" height="12" rx="3" />
      <rect x="342" y="122" width="14" height="12" rx="3" />
      <path d="M398 56 h16 v20 h-16 Z M398 80 h16 v20 h-16 Z M398 104 h16 v20 h-16 Z M403 66 h6 M403 90 h6 M403 114 h6" />
    </>
  ),
  booking_coordinator: (
    <>
      <rect x="548" y="64" width="44" height="108" rx="2" />
      <path d="M554 76 v22 M554 106 v22 M554 136 v22" />
      <circle cx="532" cy="87" r="8" />
      <circle cx="532" cy="147" r="8" />
      <rect x="426" y="62" width="6" height="90" />
      <path d="M426 84 h6 M426 107 h6 M426 130 h6" />
    </>
  ),
  inventory_clerk: (
    <>
      <rect x="46" y="212" width="16" height="176" />
      <path d="M46 234 h16 M46 256 h16 M46 278 h16 M46 300 h16 M46 322 h16 M46 344 h16 M46 366 h16" />
      <rect x="138" y="252" width="16" height="136" />
      <path d="M138 274 h16 M138 296 h16 M138 318 h16 M138 340 h16 M138 362 h16" />
      <path d="M84 340 h30 v30 h-30 Z M84 340 l30 30 M114 340 l-30 30" />
    </>
  ),
  general_staff: (
    <>
      <path d="M196 292 H300 V340 H286 V306 H196 Z" />
      <circle cx="248" cy="279" r="7" />
      <rect x="168" y="318" width="14" height="14" rx="3" />
      <rect x="168" y="336" width="14" height="14" rx="3" />
      <rect x="168" y="354" width="14" height="14" rx="3" />
      <circle cx="344" cy="258" r="8" />
      <circle cx="344" cy="258" r="3" />
    </>
  ),
  installer: (
    <>
      <rect x="366" y="252" width="20" height="96" rx="1" />
      <path d="M371 266 h10 M371 284 h10 M371 302 h10" />
      <rect x="486" y="262" width="60" height="96" rx="9" />
      <path d="M490 338 H542 M500 270 V326 M532 270 V326" />
      <path d="M482 274 v14 M550 274 v14 M482 330 v14 M550 330 v14" />
      <path d="M576 256 V352 M590 256 V352 M576 268 h14 M576 284 h14 M576 300 h14 M576 316 h14 M576 332 h14 M576 348 h14" />
      <rect x="395" y="372" width="170" height="28" strokeDasharray="4 4" />
    </>
  ),
};

function metres(units) {
  return (units / UNIT).toFixed(1);
}

export default function StaffFloorPlan({
  activeKey = null,
  success = false,
  flickerKey = 0,
  interactive = false,
  onRoomHover,
  onRoomSelect,
  compact = false,
  className = '',
}) {
  // useId() returns ":r0:"-style ids, and the colons break url(#…) references.
  const glowId = `${useId().replace(/:/g, '')}-glow`;

  const stateOf = (key) => {
    if (success) return 'lit';
    if (!activeKey) return 'idle';
    return key === activeKey ? 'active' : 'dim';
  };

  return (
    <svg
      viewBox={compact ? '30 30 580 380' : '0 0 640 452'}
      preserveAspectRatio="xMidYMid meet"
      className={`staff-plan ${compact ? 'staff-plan--compact' : ''} ${className}`}
      aria-hidden="true"
      onMouseLeave={interactive ? () => onRoomHover?.(null) : undefined}
    >
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor="#ff8a4c" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#ff6b35" stopOpacity="0.1" />
        </radialGradient>
      </defs>

      {STAFF_ROLES.map((role) => {
        const room = ROOMS[role.key];
        const state = stateOf(role.key);
        const delay = success ? `${LIGHT_ORDER.indexOf(role.key) * 90}ms` : '0ms';
        return (
          <g key={role.key} className="plan-room" data-state={state} style={{ '--plan-delay': delay }}>
            <rect
              // Remounting on a new flickerKey is what replays the flicker.
              key={flickerKey}
              x={room.x + 2} y={room.y + 2} width={room.w - 4} height={room.h - 4}
              fill={`url(#${glowId})`}
              className={`plan-fill ${state === 'active' && flickerKey ? 'auth-lights-flicker' : ''}`}
            />
            <g className="plan-furniture">{FURNITURE[role.key]}</g>
            <text x={room.label[0]} y={room.label[1]} textAnchor="middle" className="plan-text plan-label">
              {role.room.toUpperCase()}
            </text>
            <text x={room.label[0]} y={room.label[1] + 13} textAnchor="middle" className="plan-text plan-dim">
              {metres(room.w)} × {metres(room.h)} m
            </text>
            {interactive && (
              <rect
                x={room.x} y={room.y} width={room.w} height={room.h}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => onRoomHover?.(role.key)}
                onClick={() => onRoomSelect?.(role.key)}
              />
            )}
          </g>
        );
      })}

      <text x="530" y="224" textAnchor="middle" className="plan-text plan-dim">CORRIDOR</text>

      <g className="plan-structure">
        <path d={EXTERIOR_WALLS.map(segments).join(' ')} strokeWidth="6" />
        <path d={INTERIOR_WALLS.map(segments).join(' ')} strokeWidth="3" />
        <path d={WINDOWS.map(windowPath).join(' ')} strokeWidth="1" />
        <path d={DOORS.join(' ')} strokeWidth="1" />
        {/* Garage door panel across the tool bay opening. */}
        <path d="M395 400 H565" strokeWidth="1.5" />
      </g>

      {/* Overall dimensions, scale bar and north point — full-size drawing only. */}
      <g className="plan-annotation">
        <path d="M40 12 V24 M600 12 V24 M40 18 H290 M350 18 H600 M36 22 L44 14 M596 22 L604 14" />
        <path d="M12 40 H24 M12 400 H24 M18 40 V190 M18 250 V400 M14 44 L22 36 M14 404 L22 396" />
        <rect x="40" y="424" width="200" height="6" />
        <path d="M40 424 h40 v6 h-40 Z M120 424 h40 v6 h-40 Z M200 424 h40 v6 h-40 Z" className="plan-solid" />
        <circle cx="588" cy="430" r="10" />
        <path d="M588 420 L593 434 L588 430 L583 434 Z" className="plan-solid" />
      </g>
      <g className="plan-text">
        <text x="320" y="21" textAnchor="middle" className="plan-dim">{metres(560)} m</text>
        <text x="18" y="220" textAnchor="middle" className="plan-dim" transform="rotate(-90 18 220)">{metres(360)} m</text>
        <text x="40" y="444" textAnchor="middle" className="plan-dim">0</text>
        <text x="240" y="444" textAnchor="middle" className="plan-dim">5 m</text>
        <text x="606" y="434" className="plan-dim">N</text>
      </g>
    </svg>
  );
}
