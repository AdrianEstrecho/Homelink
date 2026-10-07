// The HomeLink box truck, facing right with the cab at the front. Drawn in a 440x270 space with
// the wheels touching y=262. Parked in the house builder it has its side shutter rolled `open`
// onto two shelves (the products are laid over them as buttons) and its `hazards` blinking; out
// driving on the Team page the shutter is down, showing the logo, and the lane spins the wheels
// through `wheelRefs` and bounces the body with `bodyClassName`.

export const TRUCK_SIZE = [440, 270];
export const TRUCK_WHEELS = [70, 128, 368];
export const TRUCK_WHEEL_Y = 236;
export const TRUCK_WHEEL_R = 26;

export default function DeliveryTruck({ open = false, hazards = false, wheelRefs, bodyClassName }) {
  return (
    <g>
      <ellipse cx="220" cy="263" rx="214" ry="7" fill="#0b1324" opacity=".25" />

      <g className={bodyClassName}>
        {/* Cargo box */}
        <rect x="6" y="0" width="300" height="218" rx="12" fill="#0f2b5b" />
        <text x="156" y="16" textAnchor="middle" fontFamily="Archivo, system-ui, sans-serif" fontWeight="800" fontSize="14" fill="#fff">
          Home<tspan fill="#ff6b35">Link</tspan>
          <tspan fontSize="9" fontWeight="700" fill="#9fc3ea" dx="6" letterSpacing="1.5">DELIVERY</tspan>
        </text>
        {open ? (
          <g>
            <rect x="20" y="46" width="272" height="150" rx="4" fill="#e8edf3" />
            <rect x="20" y="46" width="272" height="10" fill="#0f2b5b" opacity=".08" />
            <path d="M110 46V191M201 46V191" stroke="#cbd5e1" strokeWidth="3" />
            <rect x="20" y="118" width="272" height="5" fill="#c98b5a" />
            <rect x="20" y="191" width="272" height="5" fill="#c98b5a" />
            <rect x="14" y="22" width="284" height="24" rx="6" fill="#e2e8f0" />
            <path d="M18 28h276M18 34h276M18 40h276" stroke="#cbd5e1" strokeWidth="1.5" />
            <rect x="140" y="42" width="32" height="5" rx="2" fill="#94a3b8" />
          </g>
        ) : (
          <g>
            <rect x="14" y="22" width="284" height="174" rx="6" fill="#e2e8f0" />
            <path d={Array.from({ length: 20 }, (_, i) => `M18 ${30 + i * 8}h276`).join('')} stroke="#d5dde7" strokeWidth="1.5" />
            <rect x="48" y="70" width="216" height="76" rx="14" fill="#fff" stroke="#d5dde7" />
            <rect x="64" y="86" width="44" height="44" rx="11" fill="#ff6b35" />
            <path d="M72 110l14-12 14 12v14H72Z" fill="#fff" />
            <rect x="82" y="113" width="8" height="11" rx="1" fill="#ff6b35" />
            <text x="118" y="114" fontFamily="Archivo, system-ui, sans-serif" fontWeight="800" fontSize="26" fill="#0f2b5b">
              Home<tspan fill="#ff6b35">Link</tspan>
            </text>
            <text x="119" y="132" fontFamily="Inter, system-ui, sans-serif" fontWeight="700" fontSize="8.5" letterSpacing="1.4" fill="#64748b">
              DELIVERY &amp; INSTALLATION
            </text>
            <rect x="140" y="186" width="32" height="5" rx="2" fill="#94a3b8" />
          </g>
        )}
        <rect x="6" y="200" width="300" height="8" fill="#ff6b35" />
        <rect x="0" y="168" width="7" height="16" rx="2" fill="#ffb020" className={hazards ? 'hb-blink' : undefined} />

        {/* Cab */}
        <path d="M306 218V96a10 10 0 0 1 10-10h62a14 14 0 0 1 11.8 6.5L422 144a8 8 0 0 0 5 3h1a8 8 0 0 1 8 8V218Z" fill="#ff6b35" />
        <path d="M346 98h28a8 8 0 0 1 6.8 3.8L404 140h-58Z" fill="#bfe3ff" />
        <path d="M357 103l-6 28" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".6" />
        <path d="M340 104v108" stroke="#c8461a" strokeWidth="1.5" />
        <rect x="312" y="150" width="22" height="22" rx="5" fill="#0f2b5b" />
        <path d="M317 163l6-5 6 5v6h-12Z" fill="#fff" />
        <rect x="346" y="152" width="10" height="3.5" rx="1.5" fill="#c8461a" />
        <rect x="428" y="160" width="8" height="11" rx="2" fill="#fde68a" />
        <circle cx="432" cy="152" r="3" fill="#ffb020" className={hazards ? 'hb-blink' : undefined} />
        <rect x="420" y="206" width="20" height="10" rx="3" fill="#cbd5e1" />
        <rect x="306" y="200" width="122" height="8" fill="#e85a28" />

        {/* Chassis */}
        <rect x="10" y="214" width="420" height="14" rx="4" fill="#0b1f44" />
        {TRUCK_WHEELS.map(cx => (
          <path key={cx} d={`M${cx - 30} ${TRUCK_WHEEL_Y}a30 30 0 0 1 60 0Z`} fill="#0b1f44" />
        ))}
      </g>

      {/* Wheels: spoked so they visibly turn when the lane rotates them */}
      {TRUCK_WHEELS.map((cx, i) => (
        <g key={cx} ref={wheelRefs?.[i]}>
          <circle cx={cx} cy={TRUCK_WHEEL_Y} r={TRUCK_WHEEL_R} fill="#1f2937" />
          <circle cx={cx} cy={TRUCK_WHEEL_Y} r="14" fill="#cbd5e1" />
          <path d={`M${cx - 11} ${TRUCK_WHEEL_Y}h22M${cx} ${TRUCK_WHEEL_Y - 11}v22`} stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
          <circle cx={cx} cy={TRUCK_WHEEL_Y} r="4.5" fill="#64748b" />
        </g>
      ))}
    </g>
  );
}
