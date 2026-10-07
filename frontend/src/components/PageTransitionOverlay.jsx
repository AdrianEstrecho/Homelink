import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Logo, { LogoGlyph } from './brand/Logo';

// The delivery transition. A HomeLink truck drives across the screen from left to right, and
// its exhaust billows into a cloud that swallows the page behind it. Once nothing shows
// through, `onCovered` fires (the caller navigates there, out of sight), the logo surfaces in
// the smoke for a beat, then the cloud breaks up and drifts off after the truck, uncovering
// the new page. `onDone` fires once it's gone. App.jsx owns the only instance, for the moments
// that deserve ceremony (entering the login flow, landing after sign-in, logging out); every
// other navigation gets the quick route-fade.
//
// `stayCovered` holds on the covered screen instead of clearing, for a caller that reloads the
// page from `onCovered`. Calling arriveAfterReload() before that reload makes the new page open
// under the same smoke (index.html paints it before the app mounts), which mode="arrive" then
// clears.
//
// The smoke is a canvas. Every puff is a circle, and each frame fills the union of all of them
// three times (shadow, body, highlight), so the cloud reads as one shaded mass rather than a
// heap of outlined balls. The truck is an SVG moved from the same frame loop. Reduced motion
// gets a plain fade instead of both.

// index.html reads this same key.
const ARRIVE_KEY = 'homelink:arrive';

// Cool greys, so the cloud reads as smoke on white pages and on the navy hero alike.
const SHADE = '#c9d1dd';
const BODY = '226, 231, 239';
const LIGHT = '#f3f5f9';

// Timeline (ms from mount).
const DRIVE = 1000; // the truck crosses the screen
const COVERED = 1250; // nothing of the old page shows any more
const HOLD = 320; // the logo sits on the settled cloud
const CLEAR = 850; // the cloud breaks up and blows away
const ARRIVE_HOLD = 120;

// The truck art's viewBox, and where its exhaust pipe's mouth is in it.
const TRUCK_W = 212;
const TRUCK_H = 112;
const EXHAUST = { x: 1 / TRUCK_W, y: 82.5 / TRUCK_H };

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => lerp(a, b, Math.random());
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t;
// Gathers a little speed as it goes.
const driveEase = (t) => t * (0.7 + 0.3 * t);

export function arriveAfterReload() {
  try {
    sessionStorage.setItem(ARRIVE_KEY, '1');
  } catch {
    // Storage is blocked: the reloaded page just opens uncovered.
  }
}

export default function PageTransitionOverlay({ mode = 'cover', stayCovered = false, onCovered, onDone }) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const truckRef = useRef(null);
  const brandRef = useRef(null);
  // The timeline runs once from mount; the latest callbacks are read through a ref so a parent
  // re-rendering mid-transition doesn't restart it.
  const callbacks = useRef({ onCovered, onDone });
  callbacks.current = { onCovered, onDone };

  useEffect(() => {
    const root = rootRef.current;
    const brand = brandRef.current;
    const arrive = mode === 'arrive';
    const fire = (name) => callbacks.current[name]?.();
    const showBrand = () => brand.classList.add('smoke-brand-in');
    const hideBrand = () => brand.classList.replace('smoke-brand-in', 'smoke-brand-out');
    const uncoverBoot = () => document.documentElement.classList.remove('arriving');
    const ctx = canvasRef.current.getContext('2d');

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !ctx) {
      return plainFade({ root, arrive, stayCovered, fire, showBrand, uncoverBoot });
    }

    const W = window.innerWidth;
    const H = window.innerHeight;
    const S = Math.max(W, H);
    const canvas = canvasRef.current;
    // Full sharpness on ordinary screens; capped on huge ones so each fill stays cheap.
    const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(5e6 / (W * H)));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const truck = truckRef.current;
    const tw = truck?.offsetWidth ?? 0;
    const th = (tw * TRUCK_H) / TRUCK_W;
    const truckTop = H * 0.8 - th;
    const startX = -tw * 1.1;
    const endX = W + tw * 0.15;
    const truckX = (t) => lerp(startX, endX, driveEase(clamp01(t / DRIVE)));
    const exhaustY = truckTop + th * EXHAUST.y;

    const puffs = [];
    const gap = Math.min(40, Math.max(18, S / 42));
    let nextPuffX = startX + tw * EXHAUST.x;
    let emitted = 0;

    const exhaustPuff = (x, born) => {
      // Golden-ratio steps (jittered) spread where the puffs end up evenly between the road and
      // the top of the screen, so the cloud fills in without leaving a clear patch.
      const q = (emitted++ * 0.618034 + rand(0, 0.2)) % 1;
      const rise = lerp(-0.25, 0.95, q);
      const y = exhaustY + rand(-2, 2);
      puffs.push({
        x0: x, y0: y,
        x1: x - rand(0, 0.07) * S, y1: y - rise * y,
        r0: th * 0.06, r1: S * rand(0.12, 0.21),
        born, grow: rand(550, 800),
      });
    };

    // A jittered grid of puffs over the whole screen, sized so that together they cover it,
    // plus a smaller one dropped anywhere in each cell so the result doesn't look like a grid.
    // They're what the cloud breaks up into, so it clears as puffs rather than a fading sheet.
    const fillPuffs = (born, grown) => {
      const step = S * 0.16;
      const add = (x, y, r1) => puffs.push({ x0: x, y0: y, x1: x, y1: y, r0: grown ? r1 : 0, r1, born, grow: grown ? 1 : 320 });
      for (let gy = 0; gy < H + step; gy += step) {
        for (let gx = 0; gx < W + step; gx += step) {
          add(gx + rand(-0.08, 0.08) * step, gy + rand(-0.08, 0.08) * step, step * rand(0.95, 1.25));
          add(gx + rand(-0.5, 0.5) * step, gy + rand(-0.5, 0.5) * step, step * rand(0.45, 0.85));
        }
      }
    };

    // A flat sheet behind the puffs that guarantees the cover. It trails the truck as a
    // soft-edged front, slanted to lag further behind up top, where the smoke arrives last, and
    // is solid from the moment the page is covered until the cloud starts to clear.
    const SLANT = 0.6; // how far the front lags per px of height above the bottom edge
    const ahead = { x: 1 / Math.hypot(1, SLANT), y: -SLANT / Math.hypot(1, SLANT) };
    const feather = W * 0.25;
    const frontEnd = W + SLANT * H + feather * 1.3; // past the top-right corner
    const drawSheet = (t) => {
      if (arrive || t >= COVERED) {
        ctx.fillStyle = `rgb(${BODY})`;
        ctx.fillRect(0, 0, W, H);
        return;
      }
      // Where the front meets the bottom edge. Easing in keeps it behind the truck along the road
      // and saves the rush for after the truck has gone.
      const front = lerp(-feather, frontEnd, easeIn(clamp01((t - 300) / (COVERED - 300))));
      if (front <= 0) return;
      const g = ctx.createLinearGradient(front - feather * ahead.x, H - feather * ahead.y, front, H);
      g.addColorStop(0, `rgba(${BODY}, 1)`);
      g.addColorStop(1, `rgba(${BODY}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };

    // One union fill of every puff, offset and scaled by its radius.
    const pass = (color, ox, oy, scale) => {
      ctx.beginPath();
      for (const p of puffs) {
        if (p.r < 0.5) continue;
        const r = p.r * scale;
        const x = p.x + p.r * ox;
        const y = p.y + p.r * oy;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = color;
      ctx.fill();
    };

    // Each puff blows off downwind, the leftmost (oldest) smoke first, and shrinks away.
    const startClearing = () => {
      for (const p of puffs) {
        p.delay = (0.36 * clamp01(p.x / W) + rand(0, 0.08)) * CLEAR;
        p.dur = rand(0.32, 0.5) * CLEAR;
        p.wx = S * rand(0.25, 0.5);
        p.wy = -S * rand(0.05, 0.2);
      }
    };

    const draw = (t, clearT) => {
      const wind = clearT == null ? 0 : (clearT / 1000) ** 2;
      for (const p of puffs) {
        const age = t - p.born;
        const move = easeOut(clamp01(age / (p.grow * 1.2)));
        p.x = lerp(p.x0, p.x1, move);
        p.y = lerp(p.y0, p.y1, move);
        p.r = age < 0 ? 0 : lerp(p.r0, p.r1, easeOut(clamp01(age / p.grow)));
        if (clearT != null) {
          p.x += p.wx * wind;
          p.y += p.wy * wind;
          p.r *= 1 - easeIn(clamp01((clearT - p.delay) / p.dur));
        }
      }
      ctx.clearRect(0, 0, W, H);
      if (clearT == null) drawSheet(t);
      pass(SHADE, 0.07, 0.11, 1);
      pass(`rgb(${BODY})`, 0, 0, 1);
      pass(LIGHT, -0.17, -0.21, 0.68);
    };

    if (arrive) {
      fillPuffs(0, true);
    }

    let raf = 0;
    let t0 = 0;
    let covered = arrive;
    let clearing = false;
    const clearAt = arrive ? ARRIVE_HOLD : COVERED + HOLD;

    const frame = (now) => {
      t0 ||= now;
      const t = now - t0;

      if (truck) {
        const x = truckX(t);
        truck.style.transform = `translate3d(${x}px, ${truckTop}px, 0)`;
        const exhaustX = x + tw * EXHAUST.x;
        while (nextPuffX <= exhaustX && nextPuffX < W + S * 0.05) {
          exhaustPuff(nextPuffX, t);
          nextPuffX += gap * rand(0.8, 1.2);
        }
        if (t > DRIVE) truck.style.visibility = 'hidden';
      }

      if (!covered && t >= COVERED) {
        covered = true;
        fillPuffs(t, false);
        showBrand();
        fire('onCovered');
      }
      if (!stayCovered && !clearing && t >= clearAt) {
        clearing = true;
        startClearing();
        if (!arrive) hideBrand();
        // The new page is already showing through; let it take clicks.
        root.style.pointerEvents = 'none';
      }

      draw(t, clearing ? t - clearAt : null);
      if (arrive) uncoverBoot();

      if (clearing && t - clearAt >= CLEAR) {
        fire('onDone');
        return;
      }
      // Holding for a reload: once the cloud has settled there's nothing left to animate.
      if (stayCovered && covered && t > COVERED + 600) return;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      brand.classList.remove('smoke-brand-in', 'smoke-brand-out');
    };
    // The timeline is fixed at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-[500] overflow-hidden" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full" />
      {mode === 'cover' && (
        <div
          ref={truckRef}
          aria-hidden="true"
          className="absolute left-0 top-0 w-[clamp(150px,20vw,280px)] will-change-transform"
          style={{ transform: 'translate3d(-200%, 0, 0)' }}
        >
          <DeliveryTruck />
        </div>
      )}
      <div ref={brandRef} aria-hidden="true" className="smoke-brand absolute inset-0 flex items-center justify-center pointer-events-none">
        <Logo markClassName="w-20 sm:w-28" textClassName="text-4xl sm:text-5xl" className="gap-3 sm:gap-5" />
      </div>
    </div>,
    document.body
  );
}

// Reduced motion: no truck and no drifting smoke, just a fade to the smoke colour and back.
function plainFade({ root, arrive, stayCovered, fire, showBrand, uncoverBoot }) {
  const fade = 200;
  root.style.background = `rgb(${BODY})`;
  if (arrive) uncoverBoot();
  else root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fade, fill: 'backwards' });

  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const coveredAt = arrive ? 0 : fade;
  if (!arrive) {
    at(coveredAt, () => {
      showBrand();
      fire('onCovered');
    });
  }
  if (!stayCovered) {
    const clearAt = coveredAt + (arrive ? ARRIVE_HOLD : HOLD);
    at(clearAt, () => root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fade, fill: 'forwards' }));
    at(clearAt + fade, () => fire('onDone'));
  }
  return () => timers.forEach(clearTimeout);
}

function DeliveryTruck() {
  return (
    <svg viewBox={`0 0 ${TRUCK_W} ${TRUCK_H}`} className="block w-full h-auto overflow-visible">
      <ellipse cx="110" cy="106" rx="98" ry="4.5" fill="#0b1324" opacity=".2" />
      <g className="smoke-truck-body">
        <rect x="8" y="80" width="200" height="6" rx="3" fill="#0b1f44" />
        {/* Exhaust pipe under the back of the box: the smoke starts at its mouth (EXHAUST). */}
        <rect x="1" y="80" width="18" height="5" rx="2" fill="#94a3b8" />

        {/* Cargo box, in the brand's livery */}
        <rect x="10" y="6" width="134" height="76" rx="7" fill="#0f2b5b" />
        <path d="M18 12.5h118" stroke="#1a4a8a" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="10" y="68" width="134" height="5" fill="#ff6b35" />
        <rect x="6" y="56" width="5" height="10" rx="1.5" fill="#ef4444" />
        <g transform="translate(19 26) scale(.17)">
          <LogoGlyph house="#fff" />
        </g>
        <text x="56" y="45" fontFamily="Archivo, system-ui, sans-serif" fontWeight="800" fontSize="15" letterSpacing="-.3" fill="#fff">
          Home<tspan fill="#ff6b35">Link</tspan>
        </text>

        {/* Cab */}
        <rect x="140" y="40" width="10" height="42" fill="#0b1f44" />
        <path d="M146 84V32a8 8 0 0 1 8-8h26a8 8 0 0 1 6.5 3.4L201 48a6 6 0 0 1 5 5.9V84Z" fill="#ff6b35" />
        <path d="M166 29h13a4 4 0 0 1 3.3 1.8L192 48h-26Z" fill="#bfe3ff" />
        <path d="M172 32l-3 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".6" />
        <path d="M162 52v30" stroke="#e2531f" strokeWidth="1.2" />
        <rect x="166" y="55" width="7" height="2.5" rx="1" fill="#c2410c" />
        <rect x="201" y="58" width="6" height="7" rx="2" fill="#fde68a" />
        <rect x="198" y="78" width="12" height="7" rx="2" fill="#cbd5e1" />
      </g>

      {[46, 176].map(cx => (
        <g key={cx}>
          <path d={`M${cx - 17} 90a17 17 0 0 1 34 0Z`} fill="#0b1f44" />
          <g className="smoke-wheel">
            <circle cx={cx} cy="92" r="13" fill="#1f2937" />
            <circle cx={cx} cy="92" r="6" fill="#cbd5e1" />
            <path d={`M${cx - 6} 92h12M${cx} 86v12`} stroke="#64748b" strokeWidth="2" />
          </g>
        </g>
      ))}
    </svg>
  );
}
