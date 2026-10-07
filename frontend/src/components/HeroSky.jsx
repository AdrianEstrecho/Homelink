import { useEffect, useRef } from 'react';

// The hero's night sky (Hero.jsx): a twinkling starfield that brightens and
// joins into constellations around the cursor, plus the odd shooting star.
// It also owns the hero's one pointer listener and publishes the eased cursor
// offset as --mx/--my (-1..1) on .hero-pin for the CSS parallax layers in
// index.css, so the sky and the layers above it move off a single rAF loop.
// The canvas fades out with --progress (CSS), so scrolling the house into
// view reads as dawn breaking over it.

const STAR_DENSITY = 1 / 8000; // stars per px² of canvas
const MAX_STARS = 200;
const CURSOR_RADIUS = 170;     // stars this close to the cursor brighten...
const LINK_DISTANCE = 110;     // ...and link up with neighbours this close
const MAX_LINKED = 28;
const STAR_PARALLAX = { x: 12, y: 7 }; // px of travel for the nearest stars
const TAU = Math.PI * 2;

function makeStars(width, height) {
  const count = Math.min(MAX_STARS, Math.round(width * height * STAR_DENSITY));
  return Array.from({ length: count }, () => {
    const tint = Math.random();
    return {
      x: Math.random() * width,
      // Denser near the top, thinning toward the horizon where the house and
      // its glow take over.
      y: Math.pow(Math.random(), 1.5) * height * 0.8,
      r: 0.35 + Math.pow(Math.random(), 3) * 1.3,
      alpha: 0.25 + Math.random() * 0.6,
      speed: 0.6 + Math.random() * 1.8,
      phase: Math.random() * TAU,
      depth: 0.25 + Math.random() * 0.75,
      color: tint < 0.12 ? '255,226,190' : tint < 0.24 ? '200,220,255' : '255,255,255',
    };
  });
}

export default function HeroSky({ pinRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const pin = pinRef.current;
    if (!canvas || !pin) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const interactive = !reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    let width = 0;
    let height = 0;
    let stars = [];
    let raf = 0;
    let last = 0;

    // Raw pointer (canvas px) and its eased followers.
    const pointer = { x: 0, y: 0, inside: false };
    let glowX = 0;
    let glowY = 0;
    let presence = 0;
    let mx = 0;
    let my = 0;
    let writtenMx = 0;
    let writtenMy = 0;

    let shooting = null;
    let nextShootAt = performance.now() + 2500 + Math.random() * 4000;

    const spawnShootingStar = () => {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const angle = (16 + Math.random() * 18) * (Math.PI / 180);
      const speed = 850 + Math.random() * 350;
      shooting = {
        x: width * (0.15 + Math.random() * 0.7),
        y: height * (0.04 + Math.random() * 0.3),
        ux: Math.cos(angle) * dir,
        uy: Math.sin(angle),
        speed,
        life: 0,
        ttl: 0.8 + Math.random() * 0.4,
        length: 120 + Math.random() * 90,
      };
    };

    const drawShootingStar = (dt, now) => {
      if (!shooting) {
        if (now >= nextShootAt) spawnShootingStar();
        return;
      }
      const s = shooting;
      s.life += dt;
      s.x += s.ux * s.speed * dt;
      s.y += s.uy * s.speed * dt;
      if (s.life >= s.ttl) {
        shooting = null;
        nextShootAt = now + 6000 + Math.random() * 8000;
        return;
      }
      const fade = Math.sin((s.life / s.ttl) * Math.PI);
      const tailX = s.x - s.ux * s.length;
      const tailY = s.y - s.uy * s.length;
      const trail = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
      trail.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
      trail.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = trail;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
    };

    const draw = (t, dt, now) => {
      ctx.clearRect(0, 0, width, height);
      const offX = -mx * STAR_PARALLAX.x;
      const offY = -my * STAR_PARALLAX.y;
      const cursorOn = presence > 0.01;

      if (cursorOn) {
        const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 260);
        glow.addColorStop(0, `rgba(150,190,255,${0.1 * presence})`);
        glow.addColorStop(1, 'rgba(150,190,255,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(glowX - 260, glowY - 260, 520, 520);
      }

      const linked = [];
      for (const s of stars) {
        const x = s.x + offX * s.depth;
        const y = s.y + offY * s.depth;
        let a = reduceMotion ? s.alpha : s.alpha * (0.6 + 0.4 * Math.sin(t * s.speed + s.phase));
        let r = s.r;
        if (cursorOn) {
          const dx = x - glowX;
          const dy = y - glowY;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CURSOR_RADIUS) {
            const pull = (1 - d / CURSOR_RADIUS) * presence;
            a = Math.min(1, a + pull * 0.7);
            r += pull * 0.9;
            if (linked.length < MAX_LINKED) linked.push({ x, y, pull });
          }
        }
        if (r > 1.1) {
          ctx.fillStyle = `rgba(${s.color},${a * 0.15})`;
          ctx.beginPath();
          ctx.arc(x, y, r * 3, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(${s.color},${a})`;
        if (r < 0.9) {
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.fill();
        }
      }

      if (linked.length > 1) {
        ctx.lineWidth = 0.75;
        for (let i = 0; i < linked.length; i++) {
          for (let j = i + 1; j < linked.length; j++) {
            const a = linked[i];
            const b = linked[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d >= LINK_DISTANCE) continue;
            ctx.strokeStyle = `rgba(190,215,255,${Math.min(1, (1 - d / LINK_DISTANCE) * Math.min(a.pull, b.pull) * 1.3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      if (!reduceMotion) drawShootingStar(dt, now);
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (interactive) {
        const ease = 1 - Math.exp(-dt * 5);
        const targetX = pointer.inside ? Math.max(-1, Math.min(1, (pointer.x / width) * 2 - 1)) : 0;
        const targetY = pointer.inside ? Math.max(-1, Math.min(1, (pointer.y / height) * 2 - 1)) : 0;
        mx += (targetX - mx) * ease;
        my += (targetY - my) * ease;
        presence += ((pointer.inside ? 1 : 0) - presence) * ease;
        const follow = 1 - Math.exp(-dt * 12);
        glowX += (pointer.x - glowX) * follow;
        glowY += (pointer.y - glowY) * follow;
        // Only touch the custom properties when they've visibly moved, so a
        // resting cursor doesn't restyle the parallax layers every frame.
        if (Math.abs(mx - writtenMx) > 0.001 || Math.abs(my - writtenMy) > 0.001) {
          writtenMx = mx;
          writtenMy = my;
          pin.style.setProperty('--mx', mx.toFixed(3));
          pin.style.setProperty('--my', my.toFixed(3));
        }
      }

      draw(now / 1000, dt, now);
    };

    const start = () => {
      if (reduceMotion || raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = makeStars(width, height);
      // Without the loop (reduced motion) the sky is painted once per size.
      if (!raf) draw(0, 0, performance.now());
    };

    const onPointerMove = (e) => {
      if (e.pointerType !== 'mouse') return;
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      if (!pointer.inside) {
        // Start the glow at the cursor rather than sweeping in from wherever
        // it was last seen.
        glowX = pointer.x;
        glowY = pointer.y;
      }
      pointer.inside = true;
    };
    const onPointerLeave = () => { pointer.inside = false; };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    // The loop only runs while the hero is on screen.
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start(); else stop();
    });
    visibilityObserver.observe(canvas);
    if (interactive) {
      pin.addEventListener('pointermove', onPointerMove, { passive: true });
      pin.addEventListener('pointerleave', onPointerLeave);
    }

    return () => {
      stop();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      pin.removeEventListener('pointermove', onPointerMove);
      pin.removeEventListener('pointerleave', onPointerLeave);
      pin.style.removeProperty('--mx');
      pin.style.removeProperty('--my');
    };
  }, [pinRef]);

  return <canvas ref={canvasRef} className="hero-stars" aria-hidden="true" />;
}
