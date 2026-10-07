import { useEffect, useId, useRef, useState } from 'react';
import { Check, Hand, Package } from 'lucide-react';

// A HomeLink truck driving its delivery route past the depot and a row of customers' homes,
// each kitted out with something HomeLink sells. It drops a parcel at every door it passes.
// The truck can be grabbed and dragged (or flung) along the road, clicked to honk, or driven
// with the arrow keys once focused.
//
// The truck's position, speed and wheel spin live in a ref and are written straight onto the
// DOM each frame, so driving never re-renders React; only a delivery or a honk does. The loop
// stops while the lane is scrolled out of view. With reduced motion the truck stays parked
// until someone moves it, and the scenery holds still.

const SCENERY = [
  { kind: 'depot' },
  { kind: 'house', feature: 'solar', roof: '#0f2b5b', wall: '#ffffff' },
  { kind: 'house', feature: 'ac', roof: '#00a896', wall: '#fbf3ea' },
  { kind: 'house', feature: 'cctv', roof: '#1a4a8a', wall: '#ffffff', className: 'hidden sm:block' },
  { kind: 'house', feature: 'smart', roof: '#ff6b35', wall: '#eef4fb', className: 'hidden lg:block' },
];

const CLOUDS = [
  { top: '6%', width: 120, duration: 70, delay: -12 },
  { top: '20%', width: 84, duration: 95, delay: -55 },
  { top: '2%', width: 100, duration: 120, delay: -90 },
];

const WHEELS = [44, 162]; // wheel centers in the truck's 200-wide viewBox
const WHEEL_R = 13;
const DOOR_AT = '46.15%'; // a house's door (and roof peak) sits at x=60 of its 130-wide viewBox

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function DeliveryLane({ className = '' }) {
  const hintId = useId();
  const laneRef = useRef(null);
  const vanRef = useRef(null);
  const leanRef = useRef(null);
  const hopRef = useRef(null);
  const wheelRefs = [useRef(null), useRef(null)];
  const houseRefs = useRef([]);
  const sim = useRef({
    x: null, drawnX: 0, v: 0, cruise: 0, angle: 0, lean: 0,
    width: 0, vanW: 0, doors: [],
    dragging: false, moved: false, grab: 0, startPX: 0, lastPX: 0, lastPT: 0,
  });
  const [drops, setDrops] = useState(() => SCENERY.map(() => 0));
  const [delivered, setDelivered] = useState(0);
  const [honks, setHonks] = useState(0);

  useEffect(() => {
    const lane = laneRef.current;
    const van = vanRef.current;
    const s = sim.current;
    const reduce = reducedMotion();

    const measure = () => {
      const box = lane.getBoundingClientRect();
      s.width = box.width;
      s.vanW = van.offsetWidth;
      s.cruise = reduce ? 0 : clamp(box.width / 11, 70, 140);
      // Only houses take deliveries (the depot has no [data-door]), and only the ones this
      // breakpoint actually shows.
      s.doors = houseRefs.current.map(el => {
        const door = el?.querySelector('[data-door]');
        if (!door || !door.getClientRects().length) return null;
        const r = door.getBoundingClientRect();
        return r.left + r.width / 2 - box.left;
      });
      if (s.x === null) {
        s.x = s.drawnX = box.width * 0.06;
        s.v = s.cruise;
      }
    };

    const deliver = (i) => {
      setDrops(d => d.map((n, j) => (j === i ? n + 1 : n)));
      setDelivered(n => n + 1);
    };

    const step = (dt) => {
      if (s.dragging) {
        // Holding still while grabbed bleeds off the fling, so letting go doesn't launch it.
        s.v *= Math.exp(-dt * 10);
      } else {
        s.v += (s.cruise - s.v) * (1 - Math.exp(-dt * 1.6));
        s.x += s.v * dt;
        if (s.x > s.width) s.x = -s.vanW;
        else if (s.x < -s.vanW) s.x = s.width;
      }

      const dx = s.x - s.drawnX;
      if (Math.abs(dx) < s.width / 2) { // not the jump from wrapping around
        const wheelPx = WHEEL_R * (s.vanW / 200);
        s.angle = (s.angle + (dx / wheelPx) * (180 / Math.PI)) % 360;
        const from = s.drawnX + s.vanW / 2;
        const to = s.x + s.vanW / 2;
        if (to > from) s.doors.forEach((d, i) => { if (d != null && from < d && to >= d) deliver(i); });
      }
      s.drawnX = s.x;

      // Nose lifts when it's going faster than cruising, dips when it's dragged backwards.
      const target = clamp(-(s.v - s.cruise) / 140, -5, 5);
      s.lean += (target - s.lean) * (1 - Math.exp(-dt * 8));
    };

    const draw = () => {
      van.style.transform = `translate3d(${s.x}px,0,0)`;
      leanRef.current.style.transform = `rotate(${s.lean}deg)`;
      wheelRefs.forEach((ref, i) => ref.current?.setAttribute('transform', `rotate(${s.angle} ${WHEELS[i]} 82)`));
    };

    let raf = 0;
    let last = 0;
    let running = false;
    const loop = (t) => {
      step(last ? Math.min(0.05, (t - last) / 1000) : 0);
      last = t;
      draw();
      if (running) raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    measure();
    draw();
    const ro = new ResizeObserver(measure);
    ro.observe(lane);
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    io.observe(lane);
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  const honk = () => {
    setHonks(n => n + 1);
    if (reducedMotion()) return;
    sim.current.v += 180;
    hopRef.current?.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-9px)', offset: 0.4 }, { transform: 'translateY(0)' }],
      { duration: 420, easing: 'cubic-bezier(.3,.7,.4,1)' },
    );
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const s = sim.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    s.dragging = true;
    s.moved = false;
    s.v = 0;
    s.grab = e.clientX - s.x;
    s.startPX = s.lastPX = e.clientX;
    s.lastPT = e.timeStamp;
  };

  const onPointerMove = (e) => {
    const s = sim.current;
    if (!s.dragging) return;
    if (Math.abs(e.clientX - s.startPX) > 4) s.moved = true;
    const dt = Math.max(1, e.timeStamp - s.lastPT) / 1000;
    s.v = s.v * 0.6 + ((e.clientX - s.lastPX) / dt) * 0.4;
    s.lastPX = e.clientX;
    s.lastPT = e.timeStamp;
    s.x = clamp(e.clientX - s.grab, -s.vanW * 0.6, s.width - s.vanW * 0.4);
  };

  const endDrag = () => {
    const s = sim.current;
    if (!s.dragging) return;
    s.dragging = false;
    s.v = clamp(s.v, -1600, 1600);
  };

  // A click that ended a drag isn't a honk; Enter and Space arrive here with `moved` unset.
  const onClick = () => {
    if (!sim.current.moved) honk();
  };

  const onKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    sim.current.v += e.key === 'ArrowRight' ? 320 : -320;
  };

  return (
    <div ref={laneRef} className={`relative w-full h-[196px] sm:h-[230px] lg:h-[250px] overflow-hidden select-none ${className}`}>
      {CLOUDS.map(c => (
        <div
          key={c.delay}
          aria-hidden="true"
          className="lane-cloud absolute left-0"
          style={{ top: c.top, animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s` }}
        >
          <svg width={c.width} viewBox="0 0 120 44">
            <g fill="#0f2b5b" opacity=".07">
              <circle cx="34" cy="28" r="14" />
              <circle cx="58" cy="20" r="18" />
              <circle cx="84" cy="28" r="13" />
              <rect x="34" y="28" width="50" height="14" />
            </g>
          </svg>
        </div>
      ))}

      <div className="absolute inset-x-0 top-2 pointer-events-none">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
          <span id={hintId} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/80 backdrop-blur px-3 py-1 text-xs text-gray-600">
            <Hand className="w-3.5 h-3.5 text-brand-orange" />
            <span className="sm:hidden">Drag or tap the truck</span>
            <span className="hidden sm:inline">Drag the truck, or click it to honk</span>
            <span className="sr-only">. Focus it and use the left and right arrow keys to drive.</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/80 backdrop-blur px-3 py-1 text-xs text-gray-600">
            <Package className="w-3.5 h-3.5 text-brand-teal" />
            <span className="font-semibold tabular-nums text-brand-navy">{delivered}</span> delivered
          </span>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 mx-auto max-w-6xl px-3 sm:px-6 bottom-14 sm:bottom-16 lg:bottom-[72px] flex items-end justify-around"
      >
        {SCENERY.map((item, i) => (
          <div
            key={item.feature || item.kind}
            ref={el => { houseRefs.current[i] = el; }}
            className={`relative ${item.kind === 'depot' ? 'w-[104px] sm:w-[136px] lg:w-[150px]' : 'w-[84px] sm:w-[110px] lg:w-[124px]'} ${item.className || ''}`}
          >
            {item.kind === 'depot' ? <Depot /> : <House {...item} />}
            {drops[i] > 0 && (
              <>
                <span className="absolute bottom-full mb-1 -translate-x-1/2" style={{ left: DOOR_AT }}>
                  <span key={drops[i]} className="lane-badge inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-brand-teal px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    <Check className="w-3 h-3" strokeWidth={3} /> Delivered
                  </span>
                </span>
                <span className="absolute -bottom-1 -translate-x-1/2" style={{ left: DOOR_AT }}>
                  <span key={drops[i]} className="lane-drop relative block w-3 h-2.5 lg:w-4 lg:h-3 rounded-[2px] bg-[#d9a066] shadow-sm">
                    <span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-brand-orange/80" />
                  </span>
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="absolute inset-x-0 bottom-12 sm:bottom-14 lg:bottom-16 h-2 bg-[#e7e2d8]" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-12 sm:h-14 lg:h-16 bg-[#1c2536] border-b-[3px] border-[#cbd5e1]">
        <div
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px]"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.5) 0 26px, transparent 26px 52px)' }}
        />
      </div>

      <div ref={vanRef} className="absolute left-0 bottom-1.5 sm:bottom-2 lg:bottom-2.5 w-[132px] sm:w-[164px] lg:w-[190px] will-change-transform">
        {honks > 0 && (
          <span className="absolute bottom-full left-[80%] -translate-x-1/2 mb-1 pointer-events-none" aria-hidden="true">
            <span key={honks} className="lane-honk relative block whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-bold text-brand-navy shadow-md">
              Beep beep!
              <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-white" />
            </span>
          </span>
        )}
        <span aria-hidden="true" className="absolute left-0 bottom-[14%] flex">
          {[0, 0.4, 0.8].map(d => (
            <span key={d} className="lane-puff absolute w-2.5 h-2.5 rounded-full bg-gray-400/50" style={{ animationDelay: `${d}s` }} />
          ))}
        </span>
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onClick={onClick}
          onKeyDown={onKeyDown}
          aria-label="Honk the HomeLink delivery truck"
          aria-describedby={hintId}
          className="block w-full rounded-xl cursor-grab active:cursor-grabbing touch-pan-y"
        >
          <span ref={hopRef} className="block">
            <span ref={leanRef} className="block origin-bottom">
              <Truck wheelRefs={wheelRefs} />
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

function Truck({ wheelRefs }) {
  return (
    <svg viewBox="0 0 200 100" className="block w-full h-auto overflow-visible" aria-hidden="true">
      <ellipse cx="102" cy="96" rx="92" ry="4" fill="#0b1324" opacity=".25" />
      <g className="lane-bob">
        {/* Parcel with a CCTV camera riding on top */}
        <g className="lane-jiggle" style={{ animationDelay: '-.2s' }}>
          <rect x="14" y="34" width="34" height="28" rx="2" fill="#d9a066" />
          <rect x="14" y="34" width="34" height="5" fill="#c58c52" />
          <rect x="28.5" y="34" width="5" height="28" fill="#ff6b35" opacity=".85" />
          <rect x="25" y="31" width="8" height="3" fill="#94a3b8" />
          <rect x="19" y="24" width="20" height="7.5" rx="2.5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
          <circle cx="36" cy="27.75" r="2" fill="#1f2937" />
          <circle cx="22.5" cy="27.75" r="1" fill="#ef4444" className="lane-led" />
        </g>
        {/* Outdoor AC unit */}
        <g className="lane-jiggle" style={{ animationDelay: '-.45s' }}>
          <rect x="51" y="38" width="42" height="24" rx="2.5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.2" />
          <circle cx="63" cy="50" r="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.2" />
          <path d="M63 43v14M56 50h14" stroke="#94a3b8" strokeWidth="1.2" />
          <path d="M76 44h13M76 48h13M76 52h13M76 56h13" stroke="#cbd5e1" strokeWidth="1.4" />
        </g>
        {/* Solar panel leaning on the cab */}
        <g className="lane-jiggle" style={{ animationDelay: '-.1s' }}>
          <g transform="rotate(14 112 62)">
            <rect x="98" y="22" width="26" height="40" rx="1.5" fill="#1a4a8a" stroke="#0f2b5b" strokeWidth="1.2" />
            <path d="M106.7 22v40M115.3 22v40M98 32h26M98 42h26M98 52h26" stroke="#6ea8ff" strokeWidth=".8" opacity=".8" />
            <path d="M101 26h6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity=".6" />
          </g>
        </g>

        {/* Flatbed */}
        <rect x="8" y="60" width="124" height="14" rx="2" fill="#0f2b5b" />
        <rect x="8" y="60" width="124" height="3" fill="#1a4a8a" />
        <rect x="8" y="68" width="124" height="2.5" fill="#ff6b35" />
        <rect x="4" y="63" width="6" height="7" rx="1.5" fill="#ef4444" />
        <rect x="3" y="71" width="9" height="4" rx="1.5" fill="#cbd5e1" />

        {/* Cab */}
        <path d="M130 74V36a6 6 0 0 1 6-6h28a8 8 0 0 1 6.6 3.5L183 52a4 4 0 0 0 3 1.6h1.5a6 6 0 0 1 6 6V74Z" fill="#0f2b5b" />
        <path d="M152 35h11a4 4 0 0 1 3.3 1.8L176 51h-24Z" fill="#bfe3ff" />
        <path d="M157 37.5l-3 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".6" />
        <rect x="136" y="35" width="11" height="12" rx="2" fill="#bfe3ff" opacity=".8" />
        <path d="M150 53v19" stroke="#0b1f44" strokeWidth="1" />
        <rect x="137" y="52" width="11" height="11" rx="2.5" fill="#ff6b35" />
        <path d="M139.5 58.5l3-2.6 3 2.6v3h-6Z" fill="#fff" />
        <rect x="130" y="68" width="63.5" height="2.5" fill="#ff6b35" />
        <rect x="188.5" y="57" width="5" height="5" rx="1.5" fill="#fde68a" />
        <rect x="186" y="71" width="10" height="4" rx="1.5" fill="#cbd5e1" />
      </g>

      {WHEELS.map((cx, i) => (
        <g key={cx}>
          <path d={`M${cx - 16} 82a16 16 0 0 1 32 0Z`} fill="#0b1f44" />
          <g ref={wheelRefs[i]}>
            <circle cx={cx} cy="82" r={WHEEL_R} fill="#1f2937" />
            <circle cx={cx} cy="82" r="6.5" fill="#cbd5e1" />
            <path d={`M${cx - 6.5} 82h13M${cx} 75.5v13`} stroke="#64748b" strokeWidth="2" />
            <circle cx={cx} cy="82" r="2" fill="#475569" />
          </g>
        </g>
      ))}
    </svg>
  );
}

function Depot() {
  const stripe = 13.6;
  return (
    <svg viewBox="0 0 160 110" className="block w-full h-auto overflow-visible" aria-hidden="true">
      <rect x="10" y="40" width="140" height="70" fill="#fff" stroke="#e2ddd3" strokeWidth="1.5" />
      <rect x="6" y="34" width="148" height="8" rx="1.5" fill="#0f2b5b" />

      <path d="M60 32v2M102 32v2" stroke="#0f2b5b" strokeWidth="2" />
      <rect x="42" y="12" width="78" height="20" rx="4" fill="#fff" stroke="#0f2b5b" strokeWidth="1.5" />
      <rect x="47" y="16.5" width="11" height="11" rx="2.5" fill="#ff6b35" />
      <path d="M49.5 23l3-2.6 3 2.6v3h-6Z" fill="#fff" />
      <text x="62" y="26" fontFamily="Archivo, system-ui, sans-serif" fontWeight="800" fontSize="11" fill="#0f2b5b">
        Home<tspan fill="#ff6b35">Link</tspan>
      </text>

      {Array.from({ length: 10 }, (_, i) => {
        const fill = i % 2 ? '#fff' : '#ff6b35';
        const x = 12 + i * stripe;
        return (
          <g key={i}>
            <rect x={x} y="44" width={stripe} height="10" fill={fill} />
            <circle cx={x + stripe / 2} cy="54" r={stripe / 2} fill={fill} />
          </g>
        );
      })}

      <rect x="20" y="68" width="54" height="30" rx="2" fill="#bfdcf5" />
      <rect x="26" y="84" width="12" height="14" fill="#d9a066" />
      <rect x="40" y="88" width="10" height="10" fill="#d9a066" />
      <rect x="54" y="80" width="14" height="18" fill="#f8fafc" stroke="#94a3b8" />
      <rect x="18" y="98" width="58" height="3" fill="#e2ddd3" />

      <rect x="86" y="62" width="56" height="48" fill="#e2e8f0" />
      <path d="M86 70h56M86 78h56M86 86h56M86 94h56M86 102h56" stroke="#cbd5e1" strokeWidth="1.5" />
      <rect x="86" y="60" width="56" height="3" fill="#0f2b5b" />
    </svg>
  );
}

function House({ feature, roof, wall }) {
  const windowClass = feature === 'smart' ? 'lane-smart-window' : undefined;
  return (
    <svg viewBox="0 0 130 110" className="block w-full h-auto overflow-visible" aria-hidden="true">
      <rect x="32" y="18" width="10" height="20" fill={roof} />
      <rect x="30" y="15" width="14" height="5" rx="1" fill={roof} />
      <rect x="16" y="46" width="88" height="64" fill={wall} stroke="#e2ddd3" strokeWidth="1.5" />
      <path d="M6 50L60 12L114 50Z" fill={roof} />
      <circle cx="60" cy="35" r="5" fill="#bfdcf5" className={windowClass} />
      {[26, 74].map((x, i) => (
        <g key={x}>
          <rect x={x} y="62" width="20" height="18" rx="2" fill="#bfdcf5" className={windowClass} style={windowClass ? { animationDelay: `${i * -1.2}s` } : undefined} />
          <path d={`M${x + 10} 62v18M${x} 71h20`} stroke={wall} strokeWidth="2" />
        </g>
      ))}
      <rect data-door x="51" y="78" width="18" height="32" rx="2" fill="#0f2b5b" />
      <circle cx="65" cy="95" r="1.5" fill="#ff6b35" />

      {feature === 'solar' && (
        <g transform="translate(60 12) rotate(35.13)">
          <rect x="8" y="-6.5" width="42" height="5.5" fill="#1a4a8a" stroke="#0f2b5b" strokeWidth=".6" />
          <path d="M18.5-6.5v5.5M29-6.5v5.5M39.5-6.5v5.5" stroke="#6ea8ff" strokeWidth=".7" />
        </g>
      )}
      {feature === 'ac' && (
        <g>
          <path d="M104 98h3" stroke="#94a3b8" strokeWidth="1.5" />
          <rect x="106" y="93" width="21" height="17" rx="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.2" />
          <circle cx="113.5" cy="101.5" r="5.5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
          <path className="lane-fan" d="M113.5 97v9M109 101.5h9" stroke="#64748b" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M121 97v9M124 97v9" stroke="#cbd5e1" strokeWidth="1.2" />
        </g>
      )}
      {feature === 'cctv' && (
        <g>
          <rect x="10" y="55" width="7" height="2.5" fill="#94a3b8" />
          <g transform="rotate(-20 11 56)">
            <rect x="0" y="51.5" width="14" height="7" rx="2.5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
            <circle cx="2.5" cy="55" r="1.8" fill="#1f2937" />
            <circle cx="11" cy="53.8" r="1" fill="#ef4444" className="lane-led" />
          </g>
        </g>
      )}
    </svg>
  );
}
