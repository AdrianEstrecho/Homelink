import { useEffect, useId, useRef, useState } from 'react';
import { Gauge, Hand } from 'lucide-react';
import DeliveryTruck, { TRUCK_SIZE, TRUCK_WHEELS, TRUCK_WHEEL_R, TRUCK_WHEEL_Y } from './DeliveryTruck';

// The HomeLink truck driving along the road under the Team page header, left to right on a loop.
// It can be grabbed and dragged along the road (or flung, so it coasts before settling back to
// cruising speed), clicked or tapped to honk, and driven with the arrow keys once focused.
//
// Position, speed and wheel spin live in a ref and are written straight onto the DOM each frame,
// so driving never re-renders React; only a honk does. The loop stops while the lane is scrolled
// out of view. With reduced motion the truck stays parked until someone moves it.

const CLOUDS = [
  { top: '8%', width: 120, duration: 70, delay: -12 },
  { top: '24%', width: 84, duration: 95, delay: -55 },
  { top: '2%', width: 100, duration: 120, delay: -90 },
];

// Faint city blocks along the horizon, tiled across the lane behind the road.
const SKYLINE = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 100'><path fill='#0f2b5b' fill-opacity='.05' d='M0 100V62h18V44h16v24h14V30h20v26h14v-8h18v18h12V22h16v32h14v10h18V40h20v20h14V50h18v20h12V34h20v28h16V46h16v12h16V38h16v26h12v36z'/></svg>",
)}")`;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// "Beep beep": two short blasts of a two-tone car horn, synthesised with Web Audio so there's no
// sound file to ship. The audio context is made on the first honk, since browsers only let sound
// start from a click or key press, and reused after that.
let audioCtx = null;
function playHorn() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const ctx = audioCtx;

  const volume = ctx.createGain();
  volume.gain.value = 0.12;
  const muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.frequency.value = 1800;
  muffle.connect(volume);
  volume.connect(ctx.destination);

  const start = ctx.currentTime + 0.01;
  [0, 0.24].forEach(offset => {
    const t = start + offset;
    const blast = ctx.createGain();
    blast.gain.setValueAtTime(0, t);
    blast.gain.linearRampToValueAtTime(1, t + 0.015);
    blast.gain.setValueAtTime(1, t + 0.15);
    blast.gain.linearRampToValueAtTime(0, t + 0.18);
    blast.connect(muffle);
    // Two notes a major third apart, the classic car-horn chord.
    [415, 523].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(blast);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  });
}

export default function DeliveryLane({ className = '' }) {
  const hintId = useId();
  const laneRef = useRef(null);
  const truckRef = useRef(null);
  const leanRef = useRef(null);
  const hopRef = useRef(null);
  const speedRef = useRef(null);
  const wheelRefs = [useRef(null), useRef(null), useRef(null)];
  const sim = useRef({
    x: null, drawnX: 0, v: 0, cruise: 0, angle: 0, lean: 0, width: 0, truckW: 0,
    dragging: false, moved: false, grab: 0, startPX: 0, lastPX: 0, lastPT: 0,
  });
  const [honks, setHonks] = useState(0);

  useEffect(() => {
    const lane = laneRef.current;
    const truck = truckRef.current;
    const s = sim.current;
    const reduce = reducedMotion();

    const measure = () => {
      s.width = lane.getBoundingClientRect().width;
      s.truckW = truck.offsetWidth;
      s.cruise = reduce ? 0 : clamp(s.width / 10, 80, 150);
      if (s.x === null) {
        s.x = s.drawnX = s.width * 0.08;
        s.v = s.cruise;
      }
    };

    const step = (dt) => {
      if (s.dragging) {
        // Holding still while grabbed bleeds off the fling, so letting go doesn't launch it.
        s.v *= Math.exp(-dt * 10);
      } else {
        s.v += (s.cruise - s.v) * (1 - Math.exp(-dt * 1.6));
        s.x += s.v * dt;
        if (s.x > s.width) s.x = -s.truckW;
        else if (s.x < -s.truckW) s.x = s.width;
      }
      const dx = s.x - s.drawnX;
      if (Math.abs(dx) < s.width / 2) { // not the jump from wrapping around
        const wheelPx = TRUCK_WHEEL_R * (s.truckW / TRUCK_SIZE[0]);
        s.angle = (s.angle + (dx / wheelPx) * (180 / Math.PI)) % 360;
      }
      s.drawnX = s.x;
      // Nose lifts when it's going faster than cruising, dips when it's dragged backwards.
      const target = clamp(-(s.v - s.cruise) / 160, -4, 4);
      s.lean += (target - s.lean) * (1 - Math.exp(-dt * 8));
    };

    let lastSpeed = -1;
    const draw = () => {
      truck.style.transform = `translate3d(${s.x}px,0,0)`;
      leanRef.current.style.transform = `rotate(${s.lean}deg)`;
      wheelRefs.forEach((ref, i) => ref.current?.setAttribute('transform', `rotate(${s.angle} ${TRUCK_WHEELS[i]} ${TRUCK_WHEEL_Y})`));
      // A made-up km/h for the speedometer: cruising reads about 40.
      const speed = Math.min(199, Math.round(Math.abs(s.v) / 3));
      if (speed !== lastSpeed && speedRef.current) {
        lastSpeed = speed;
        speedRef.current.textContent = speed;
      }
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
    playHorn();
    if (reducedMotion()) return;
    sim.current.v += 200;
    hopRef.current?.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-10px)', offset: 0.4 }, { transform: 'translateY(0)' }],
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
    s.x = clamp(e.clientX - s.grab, -s.truckW * 0.6, s.width - s.truckW * 0.4);
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
    <div ref={laneRef} className={`relative w-full h-[176px] sm:h-[210px] lg:h-[240px] overflow-hidden select-none ${className}`}>
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
          <span aria-hidden="true" className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/80 backdrop-blur px-3 py-1 text-xs text-gray-600">
            <Gauge className="w-3.5 h-3.5 text-brand-teal" />
            <span ref={speedRef} className="font-semibold tabular-nums text-brand-navy">0</span> km/h
          </span>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-[58px] sm:bottom-[66px] lg:bottom-[76px] h-[70px] sm:h-[90px] lg:h-[110px] bg-repeat-x"
        style={{ backgroundImage: SKYLINE, backgroundSize: 'auto 100%', backgroundPosition: 'left bottom' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-12 sm:bottom-14 lg:bottom-16 h-2.5 lg:h-3 bg-[#e7e2d8] border-b-2 border-[#cfc8ba]"
        style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 30px, rgba(15,43,91,.08) 30px 31px)' }}
      />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-12 sm:h-14 lg:h-16 bg-[#1c2536] border-b-[3px] border-[#cbd5e1]">
        <div
          className="absolute inset-x-0 top-[62%] -translate-y-1/2 h-[3px]"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.5) 0 26px, transparent 26px 52px)' }}
        />
      </div>

      <div ref={truckRef} className="absolute left-0 bottom-1 sm:bottom-1.5 lg:bottom-2 w-[190px] sm:w-[236px] lg:w-[280px] will-change-transform">
        {honks > 0 && (
          <span className="absolute bottom-full left-[84%] -translate-x-1/2 mb-1 pointer-events-none" aria-hidden="true">
            <span key={honks} className="lane-honk relative block whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-bold text-brand-navy shadow-md">
              Beep beep!
              <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-white" />
            </span>
          </span>
        )}
        <span aria-hidden="true" className="absolute left-0 bottom-[22%] flex">
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
              <svg viewBox={`0 0 ${TRUCK_SIZE[0]} ${TRUCK_SIZE[1]}`} className="block w-full h-auto overflow-visible" aria-hidden="true">
                <DeliveryTruck wheelRefs={wheelRefs} bodyClassName="lane-bob" />
              </svg>
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
