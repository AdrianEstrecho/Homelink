import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Check, Hand, RotateCcw, ShoppingBag, Sparkles, Wrench } from 'lucide-react';

// "Kit out a HomeLink home": a cut-away house with a spot for each of six HomeLink products.
// Drag a product onto the house (or tap it, then tap a spot). The right spot glows green and the
// product snaps in, and the room it's in comes to life; a wrong spot glows red and the product
// goes back with a hint. Leave it alone for IDLE_MS and a demo takes over, flying the remaining
// products into place one by one — touching anything hands control straight back.

const IDLE_MS = 5000;
const VIEW_W = 480;
const VIEW_H = 400;

// `at`/`box` place the installed artwork in the house's 480x400 viewBox; `hit` is the (roomier)
// drop target over it.
const PRODUCTS = [
  { id: 'solar', name: 'Solar Panels', category: 'Solar', noun: 'solar panels', spot: 'Roof', at: [236, 72], box: [120, 62], hit: [230, 66, 132, 74], done: 'free power from the sun.', hint: 'Solar panels go up on the roof, in the sun.' },
  { id: 'ac', name: 'Air Conditioner', category: 'Aircon', noun: 'air conditioner', spot: 'Bedroom wall', at: [80, 172], box: [96, 34], hit: [76, 166, 104, 48], done: 'the bedroom is cooling down.', hint: 'The aircon goes high on the bedroom wall.' },
  { id: 'heater', name: 'Water Heater', category: 'Plumbing', noun: 'water heater', spot: 'Bathroom wall', at: [360, 176], box: [40, 74], hit: [350, 172, 60, 82], done: 'hot showers are on.', hint: 'The water heater goes in the bathroom, next to the shower.' },
  { id: 'bulb', name: 'Smart Bulb', category: 'Smart Home', noun: 'smart bulb', spot: 'Ceiling', at: [138, 272], box: [30, 48], hit: [120, 272, 66, 60], done: 'the living room lights up.', hint: 'The smart bulb hangs from the living room ceiling.' },
  { id: 'lock', name: 'Smart Lock', category: 'Smart Home', noun: 'smart lock', spot: 'Front door', at: [326, 316], box: [22, 34], hit: [306, 302, 62, 62], done: 'the front door is secured.', hint: 'The smart lock goes on the front door.' },
  { id: 'cctv', name: 'CCTV Camera', category: 'Security', noun: 'CCTV camera', spot: 'Outside corner', at: [14, 158], box: [46, 28], hit: [4, 144, 64, 52], labelStart: true, done: 'the yard is being watched.', hint: 'The CCTV camera mounts outside, just under the roof.' },
];
const BY_ID = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));

const READY = `${PRODUCTS.length} products are waiting to be installed.`;
const DONE = 'Every product is in. This home is fully HomeLinked!';

const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  return {
    dx: Math.cos(a) * (90 + (i % 3) * 40),
    dy: Math.sin(a) * (70 + (i % 4) * 25) - 30,
    rot: (i * 97) % 360,
    color: ['#ff6b35', '#00a896', '#1a4a8a', '#ffd27a'][i % 4],
    delay: (i % 5) * 40,
  };
});

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const pct = ([x, y, w, h]) => ({
  left: `${(x / VIEW_W) * 100}%`,
  top: `${(y / VIEW_H) * 100}%`,
  width: `${(w / VIEW_W) * 100}%`,
  height: `${(h / VIEW_H) * 100}%`,
});

const SLOT_TONES = {
  idle: 'border-brand-navy/25 bg-white/35 hover:bg-white/60',
  ready: 'border-brand-orange/80 bg-brand-orange/10',
  good: 'border-brand-teal bg-brand-teal/20 shadow-[0_0_0_4px_rgba(0,168,150,0.25)]',
  bad: 'border-red-500 bg-red-500/15',
};
const LABEL_TONES = {
  idle: 'bg-white text-brand-navy',
  ready: 'bg-brand-orange text-white',
  good: 'bg-brand-teal text-white',
  bad: 'bg-red-500 text-white',
};
const MESSAGE_TONES = {
  info: 'bg-gray-50 text-gray-600 border-gray-200',
  success: 'bg-brand-teal/10 text-[#00806f] border-brand-teal/25',
  error: 'bg-red-50 text-red-700 border-red-200',
};

export default function HomeBuilder({ className = '' }) {
  const uid = useId().replace(/:/g, '');
  const rootRef = useRef(null);
  const slotRefs = useRef({});
  const tileRefs = useRef({});

  const [installed, setInstalled] = useState({});
  const [selected, setSelected] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const [flash, setFlash] = useState(null);
  const [flight, setFlight] = useState(null);
  const [demo, setDemo] = useState(false);
  const [round, setRound] = useState(0);
  const [message, setMessage] = useState({ tone: 'info', text: READY });

  const installedRef = useRef(installed);
  installedRef.current = installed;
  const drag = useRef(null);
  const ghostRef = useRef(null);
  const suppressClick = useRef(false);
  const flightAnim = useRef(null);
  const demoRef = useRef(false);
  const lastTouch = useRef(Date.now());
  const inView = useRef(false);
  const nextStepAt = useRef(0);
  const completed = useRef({ at: 0, byDemo: false });

  const count = PRODUCTS.filter(p => installed[p.id]).length;
  const complete = count === PRODUCTS.length;

  const say = (tone, text) => setMessage({ tone, text });

  const place = (id, slotId, { auto = false } = {}) => {
    const product = BY_ID[id];
    if (!slotId) {
      say('info', `Drop the ${product.noun} right onto the house.`);
      return false;
    }
    if (slotId !== id) {
      setFlash(slotId);
      setTimeout(() => setFlash(f => (f === slotId ? null : f)), 700);
      tileRefs.current[id]?.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
        { duration: 380 },
      );
      say('error', `That spot is for the ${BY_ID[slotId].noun}. ${product.hint}`);
      return false;
    }
    const next = { ...installedRef.current, [id]: true };
    installedRef.current = next;
    setInstalled(next);
    if (PRODUCTS.every(p => next[p.id])) {
      completed.current = { at: Date.now(), byDemo: auto };
      setRound(r => r + 1);
      say('success', DONE);
    } else {
      say('success', `${capitalize(product.noun)} installed: ${product.done}`);
    }
    return true;
  };

  const reset = () => {
    installedRef.current = {};
    setInstalled({});
    setSelected(null);
    say('info', READY);
  };

  // Any press or key inside hands control back from the demo and restarts the idle clock. Just
  // moving the pointer over it only holds the demo off; it doesn't stop one that's running.
  const takeOver = () => {
    lastTouch.current = Date.now();
    if (flightAnim.current) {
      flightAnim.current.cancel();
      flightAnim.current = null;
      setFlight(null);
    }
    demoRef.current = false;
    setDemo(false);
  };
  const noteActivity = () => {
    if (!demoRef.current) lastTouch.current = Date.now();
  };

  const flyTo = (id) => {
    const tile = tileRefs.current[id];
    const slot = slotRefs.current[id];
    if (!tile || !slot) return;
    if (reducedMotion()) {
      place(id, id, { auto: true });
      nextStepAt.current = Date.now() + 1500;
      return;
    }
    const a = tile.getBoundingClientRect();
    const b = slot.getBoundingClientRect();
    setFlight({
      id,
      from: { x: a.left + a.width / 2, y: a.top + a.height / 2 },
      to: { x: b.left + b.width / 2, y: b.top + b.height / 2 },
    });
  };

  const land = (id) => {
    flightAnim.current = null;
    setFlight(null);
    place(id, id, { auto: true });
    nextStepAt.current = Date.now() + 1100;
  };

  // The demo's clock: once the house has sat in view, untouched, for IDLE_MS, install whatever's
  // left one product at a time; when it's all in, hold the finished house a moment and start over.
  const tick = useRef(null);
  tick.current = () => {
    if (!inView.current || drag.current || flightAnim.current || flight) return;
    const now = Date.now();
    if (now - lastTouch.current < IDLE_MS) return;
    if (!demoRef.current) {
      demoRef.current = true;
      setDemo(true);
      setSelected(null);
      nextStepAt.current = now;
    }
    if (now < nextStepAt.current) return;
    const left = PRODUCTS.find(p => !installedRef.current[p.id]);
    if (left) {
      flyTo(left.id);
    } else if (now - completed.current.at > (completed.current.byDemo ? 3500 : 6000)) {
      reset();
      nextStepAt.current = now + 900;
    }
  };

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => {
      inView.current = entry.isIntersecting;
      if (entry.isIntersecting && !demoRef.current) lastTouch.current = Date.now();
    }, { threshold: 0.35 });
    io.observe(rootRef.current);
    const timer = setInterval(() => tick.current(), 250);
    return () => {
      io.disconnect();
      clearInterval(timer);
      flightAnim.current?.cancel();
    };
  }, []);

  const hitSlot = (x, y) => {
    let best = null;
    let bestDist = Infinity;
    for (const p of PRODUCTS) {
      if (installedRef.current[p.id]) continue;
      const r = slotRefs.current[p.id]?.getBoundingClientRect();
      if (!r) continue;
      const pad = 14;
      if (x < r.left - pad || x > r.right + pad || y < r.top - pad || y > r.bottom + pad) continue;
      const dist = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (dist < bestDist) {
        bestDist = dist;
        best = p.id;
      }
    }
    return best;
  };

  const moveGhost = (x, y) => {
    if (ghostRef.current) ghostRef.current.style.transform = `translate(${x}px, ${y}px)`;
  };

  const onTileDown = (e, id) => {
    if (e.button > 0 || installedRef.current[id]) return;
    suppressClick.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false };
  };

  const onTileMove = (e) => {
    const d = drag.current;
    if (!d) return;
    d.x = e.clientX;
    d.y = e.clientY;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
      d.active = true;
      setDragId(d.id);
      setSelected(null);
    }
    moveGhost(e.clientX, e.clientY);
    const hit = hitSlot(e.clientX, e.clientY);
    setOver(prev => (prev === hit ? prev : hit));
  };

  const endDrag = (e, cancelled = false) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    suppressClick.current = true;
    setDragId(null);
    setOver(null);
    if (!cancelled) place(d.id, hitSlot(e.clientX, e.clientY));
  };

  const onTileClick = (id) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (selected === id) {
      setSelected(null);
      say('info', READY);
    } else {
      setSelected(id);
      say('info', `Now tap where the ${BY_ID[id].noun} goes.`);
    }
  };

  const onSlotClick = (slotId) => {
    if (!selected) {
      say('info', 'Pick a product first, then tap its spot on the house.');
      return;
    }
    if (place(selected, slotId)) setSelected(null);
  };

  const targeting = Boolean(dragId || selected || flight);

  return (
    <section
      ref={rootRef}
      aria-labelledby={`${uid}-title`}
      onPointerDownCapture={takeOver}
      onKeyDownCapture={takeOver}
      onPointerMove={noteActivity}
      className={`card p-4 sm:p-6 lg:p-8 grid gap-5 lg:gap-x-8 lg:gap-y-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] ${className}`}
    >
      {/* Heading — first on phones, top right beside the house from lg up. */}
      <div className="order-1 lg:col-start-2 lg:row-start-1">
        <p className="eyebrow mb-2"><Sparkles className="w-3.5 h-3.5" /> Try it</p>
        <h2 id={`${uid}-title`} className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-brand-ink">Kit out a HomeLink home</h2>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">
          Drag each product to where it belongs on the house, or tap a product and then its spot.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-orange to-brand-teal transition-[width] duration-500"
              style={{ width: `${(count / PRODUCTS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-brand-navy">{count}/{PRODUCTS.length} installed</span>
        </div>
      </div>

      {/* Products, status and actions. Before the house in the DOM so keyboard users meet the
          products first and then the spots; shown below it on phones. */}
      <div className="order-3 lg:col-start-2 lg:row-start-2">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {PRODUCTS.map(p => {
            const done = Boolean(installed[p.id]);
            const away = dragId === p.id || flight?.id === p.id;
            return (
              <button
                key={p.id}
                ref={el => { tileRefs.current[p.id] = el; }}
                type="button"
                disabled={done}
                onPointerDown={e => onTileDown(e, p.id)}
                onPointerMove={onTileMove}
                onPointerUp={e => endDrag(e)}
                onPointerCancel={e => endDrag(e, true)}
                onClick={() => onTileClick(p.id)}
                aria-pressed={selected === p.id}
                aria-label={`${p.name}${done ? ', installed' : ''}`}
                className={`relative flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 sm:p-2.5 text-center select-none touch-none transition ${
                  done
                    ? 'border-brand-teal/30 bg-brand-teal/[0.06] cursor-default'
                    : selected === p.id
                      ? 'border-brand-orange bg-brand-orange/5 ring-2 ring-brand-orange/30 cursor-grab'
                      : 'border-gray-200 bg-white hover:border-brand-navy/30 hover:-translate-y-0.5 hover:shadow-md cursor-grab active:cursor-grabbing'
                } ${away ? 'opacity-40' : ''}`}
              >
                <ProductIcon id={p.id} className={`h-9 sm:h-11 w-auto max-w-full ${done ? 'opacity-50' : ''}`} />
                <span className="text-[11px] sm:text-xs font-semibold leading-tight text-brand-ink">{p.name}</span>
                <span className={`text-[10px] leading-none ${done ? 'text-[#00806f] font-semibold' : 'text-gray-400'}`}>{done ? 'Installed' : p.category}</span>
                {done && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-teal text-white flex items-center justify-center shadow">
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p role="status" className={`mt-4 rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed transition-colors ${MESSAGE_TONES[message.tone]}`}>
          {message.text}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {complete && (
            <>
              <Link to="/products" className="btn-primary inline-flex items-center gap-1.5 text-sm py-2 px-4">
                <ShoppingBag className="w-4 h-4" /> Shop products
              </Link>
              <Link to="/services" className="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-4">
                <Wrench className="w-4 h-4" /> Book an installation
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={reset}
            disabled={!count}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-brand-navy hover:bg-gray-100 transition disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <RotateCcw className="w-4 h-4" /> Start over
          </button>
        </div>
      </div>

      {/* The house */}
      <div className="order-2 lg:col-start-1 lg:row-start-1 lg:row-span-2 self-start relative rounded-2xl overflow-hidden border border-white bg-gradient-to-b from-[#d9eefb] via-[#eef8fd] to-[#f7fbf8]">
        <HouseScene installed={installed} uid={uid} />

        {PRODUCTS.map(p => {
          if (installed[p.id]) return null;
          const tone = over === p.id ? (dragId === p.id ? 'good' : 'bad') : flash === p.id ? 'bad' : targeting ? 'ready' : 'idle';
          return (
            <button
              key={p.id}
              ref={el => { slotRefs.current[p.id] = el; }}
              type="button"
              onClick={() => onSlotClick(p.id)}
              aria-label={`${p.spot}: place ${selected ? `the ${BY_ID[selected].noun}` : 'a product'} here`}
              className={`absolute rounded-xl border-2 border-dashed transition duration-200 ${SLOT_TONES[tone]}`}
              style={pct(p.hit)}
            >
              {tone === 'idle' && <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-lg font-bold leading-none text-brand-navy/35">+</span>}
              <span
                aria-hidden="true"
                className={`absolute -top-1.5 -translate-y-full whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm transition-opacity ${
                  p.labelStart ? 'left-0' : 'left-1/2 -translate-x-1/2'
                } ${tone === 'idle' ? 'opacity-0' : 'opacity-100'} ${LABEL_TONES[tone]}`}
              >
                {tone === 'good' ? 'Drop to install' : tone === 'bad' ? 'Not here' : p.spot}
              </span>
            </button>
          );
        })}

        {demo && (
          <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-brand-navy shadow-sm">
            <span className="hb-blink w-2 h-2 rounded-full bg-brand-orange" />
            Demo playing. Grab a product to take over
          </span>
        )}
        {complete && (
          <>
            <span className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2">
              <span className="fade-up inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-teal px-3 py-1 text-xs font-bold text-white shadow-md">
                <Sparkles className="w-3.5 h-3.5" /> Fully HomeLinked!
              </span>
            </span>
            <div key={round} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[45%]">
              {CONFETTI.map((c, i) => (
                <span
                  key={i}
                  className="hb-confetti absolute w-2 h-3 rounded-[2px]"
                  style={{ backgroundColor: c.color, '--dx': `${c.dx}px`, '--dy': `${c.dy}px`, '--rot': `${c.rot}deg`, animationDelay: `${c.delay}ms` }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {dragId && createPortal(
        <div
          ref={ghostRef}
          className="fixed left-0 top-0 z-[200] pointer-events-none"
          style={{ transform: `translate(${drag.current?.x ?? 0}px, ${drag.current?.y ?? 0}px)` }}
        >
          <div className="-translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5">
            <GhostCard id={dragId} tone={over ? (over === dragId ? 'good' : 'bad') : 'idle'} />
            {over && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold shadow ${LABEL_TONES[over === dragId ? 'good' : 'bad']}`}>
                {over === dragId ? 'Drop to install' : 'Not here'}
              </span>
            )}
          </div>
        </div>,
        document.body,
      )}
      {flight && <FlightGhost key={flight.id} flight={flight} animRef={flightAnim} onLand={() => land(flight.id)} />}
    </section>
  );
}

const GHOST_RINGS = { idle: 'ring-brand-orange/60', good: 'ring-brand-teal', bad: 'ring-red-500' };

function GhostCard({ id, tone }) {
  return (
    <div className={`w-[88px] rounded-2xl bg-white p-2 shadow-2xl ring-2 ${GHOST_RINGS[tone]} flex flex-col items-center gap-1 rotate-[-4deg]`}>
      <ProductIcon id={id} className="h-11 w-auto max-w-full" />
      <span className="text-[10px] font-semibold leading-tight text-center text-brand-ink">{BY_ID[id].name}</span>
    </div>
  );
}

// The demo's "hand": carries a product from its tile to its spot along a lifted arc.
function FlightGhost({ flight, animRef, onLand }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const { from, to } = flight;
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 70 };
    const at = (p, s) => `translate(${p.x}px, ${p.y}px) scale(${s})`;
    const anim = ref.current.animate(
      [
        { transform: at(from, 0.7), opacity: 0 },
        { transform: at(from, 1), opacity: 1, offset: 0.12 },
        { transform: at(mid, 1.08), opacity: 1, offset: 0.55 },
        { transform: at(to, 0.92), opacity: 1 },
      ],
      { duration: 1400, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' },
    );
    animRef.current = anim;
    anim.onfinish = onLand;
    return () => anim.cancel();
  }, []);

  return createPortal(
    <div ref={ref} className="fixed left-0 top-0 z-[200] pointer-events-none" style={{ opacity: 0 }}>
      <div className="relative -translate-x-1/2 -translate-y-1/2">
        <GhostCard id={flight.id} tone="idle" />
        <Hand className="absolute -right-3 -bottom-3 w-8 h-8 text-brand-navy drop-shadow" fill="#fff" strokeWidth={1.6} />
      </div>
    </div>,
    document.body,
  );
}

function ProductIcon({ id, className }) {
  const [w, h] = BY_ID[id].box;
  const pad = 6;
  return (
    <svg viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} className={className} aria-hidden="true">
      <ProductArt id={id} />
    </svg>
  );
}

// ——— Product artwork. Each draws inside its own `box` from 0,0; `live` adds what it does once
// it's installed (the solar glint, the aircon's breeze, the camera's sweep...). ———

function ProductArt({ id, live = false, clipId }) {
  switch (id) {
    case 'solar': return <SolarArt live={live} clipId={clipId} />;
    case 'ac': return <AcArt live={live} />;
    case 'heater': return <HeaterArt live={live} />;
    case 'bulb': return <BulbArt live={live} />;
    case 'lock': return <LockArt live={live} />;
    case 'cctv': return <CctvArt live={live} />;
    default: return null;
  }
}

function SolarArt({ live, clipId }) {
  return (
    <g>
      <rect x="-2" y="-2" width="124" height="66" rx="3" fill="#0b1f44" />
      <g clipPath={live ? `url(#${clipId})` : undefined}>
        {[0, 1].map(r => [0, 1, 2, 3].map(c => {
          const x = c * 30;
          const y = r * 31;
          return (
            <g key={`${r}${c}`}>
              <rect x={x} y={y} width="28" height="29" rx="1" fill="#1a4a8a" />
              <path d={`M${x + 14} ${y}v29M${x} ${y + 9.7}h28M${x} ${y + 19.3}h28`} stroke="#6ea8ff" strokeWidth=".8" opacity=".7" />
            </g>
          );
        }))}
        <path d="M8 60L42 2H52L18 60Z" fill="#fff" opacity=".1" />
        {live && <rect className="hb-glint" x="-24" y="-6" width="14" height="76" fill="#fff" opacity=".45" />}
      </g>
    </g>
  );
}

function AcArt({ live }) {
  return (
    <g>
      <rect x="0" y="0" width="96" height="28" rx="6" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
      <rect x="4" y="18" width="88" height="6" rx="2" fill="#e2e8f0" />
      <path d="M8 21h80" stroke="#cbd5e1" strokeWidth="1" />
      <rect x="8" y="6" width="9" height="6" rx="1.5" fill="#ff6b35" />
      <circle cx="86" cy="9" r="2" fill={live ? '#00a896' : '#cbd5e1'} className={live ? 'hb-blink' : undefined} />
      {live && (
        <g fill="none" stroke="#7cc4f0" strokeWidth="2" strokeLinecap="round">
          {[22, 48, 74].map((x, i) => (
            <path key={x} className="hb-air" style={{ animationDelay: `${i * -0.6}s` }} d={`M${x} 32q3 4 0 8t0 8`} />
          ))}
        </g>
      )}
    </g>
  );
}

function HeaterArt({ live }) {
  return (
    <g>
      <path d="M12 62v12" stroke="#ef4444" strokeWidth="3" />
      <path d="M28 62v12" stroke="#3b82f6" strokeWidth="3" />
      <rect x="0" y="0" width="40" height="62" rx="12" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
      <rect x="1" y="40" width="38" height="5" fill="#ff6b35" />
      <circle cx="20" cy="20" r="7" fill="#fff" stroke="#94a3b8" strokeWidth="1.2" />
      <path d={live ? 'M20 20l5-3' : 'M20 20l-4-4'} stroke={live ? '#ef4444' : '#94a3b8'} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="20" cy="52" r="2.2" fill={live ? '#ef4444' : '#cbd5e1'} className={live ? 'hb-blink' : undefined} />
    </g>
  );
}

function BulbArt({ live }) {
  return (
    <g>
      <path d="M15 0v18" stroke="#475569" strokeWidth="1.5" />
      <rect x="10" y="17" width="10" height="7" rx="1.5" fill="#475569" />
      {live && <circle className="hb-glow" cx="15" cy="33" r="18" fill="#ffd27a" opacity=".4" />}
      <circle cx="15" cy="33" r="9" fill={live ? '#ffe28a' : '#fff6d6'} stroke="#f5b93d" strokeWidth="1.4" />
      <path d="M11.5 33q1.75-3 3.5 0t3.5 0" stroke={live ? '#e08a00' : '#d6a23a'} strokeWidth="1.2" fill="none" />
    </g>
  );
}

function LockArt({ live }) {
  return (
    <g>
      <rect x="0" y="0" width="22" height="34" rx="4" fill="#1f2937" />
      <circle cx="11" cy="5.5" r="2" fill={live ? '#00a896' : '#475569'} className={live ? 'hb-blink' : undefined} />
      {[0, 1, 2].map(r => [0, 1, 2].map(c => (
        <circle key={`${r}${c}`} cx={5 + c * 6} cy={12 + r * 5} r="1.3" fill="#94a3b8" />
      )))}
      <rect x="3" y="28" width="16" height="3" rx="1.5" fill="#cbd5e1" />
      {live && (
        // Positioned by the outer group: the pop's CSS transform would replace a transform attribute.
        <g transform="translate(-6 -30)">
          <g className="hb-pop">
            <circle cx="14" cy="10" r="9" fill="#00a896" />
            <path d="M10 10l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      )}
    </g>
  );
}

function CctvArt({ live }) {
  return (
    <g>
      {live && <path className="hb-scan" d="M6 18L-22 48L-4 58Z" fill="#ff6b35" opacity=".16" />}
      <path d="M32 14H44" stroke="#94a3b8" strokeWidth="3" />
      <rect x="42" y="6" width="4" height="16" rx="1" fill="#94a3b8" />
      <g transform="rotate(-16 22 14)">
        <rect x="2" y="7" width="32" height="14" rx="5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.2" />
        <rect x="0" y="5" width="30" height="4" rx="2" fill="#e2e8f0" />
        <circle cx="6" cy="14" r="3.2" fill="#1f2937" />
        <circle cx="28" cy="11.5" r="1.4" fill={live ? '#ef4444' : '#cbd5e1'} className={live ? 'hb-blink' : undefined} />
      </g>
    </g>
  );
}

// ——— The house: a cut-away with the front wall off, so the rooms each product belongs in show. ———

function Win({ x, y, w, h }) {
  return (
    <g>
      <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} rx="2" fill="#fff" stroke="#e2ddd3" strokeWidth=".8" />
      <rect x={x} y={y} width={w} height={h} fill="#bfdcf5" />
      <path d={`M${x + w * 0.12} ${y + h}L${x + w * 0.5} ${y}H${x + w * 0.68}L${x + w * 0.3} ${y + h}Z`} fill="#fff" opacity=".35" />
      <path d={`M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}`} stroke="#fff" strokeWidth="2" />
      <rect x={x - 4} y={y + h + 2} width={w + 8} height="3" rx="1" fill="#e2ddd3" />
    </g>
  );
}

function Cloud({ y, s }) {
  return (
    <g transform={`translate(0 ${y}) scale(${s})`} fill="#fff" opacity=".9">
      <circle cx="24" cy="18" r="12" />
      <circle cx="44" cy="12" r="15" />
      <circle cx="64" cy="19" r="11" />
      <rect x="24" y="18" width="40" height="12" />
    </g>
  );
}

function HouseScene({ installed, uid }) {
  const on = (id) => Boolean(installed[id]);
  const fade = (visible, max = 1) => ({ opacity: visible ? max : 0 });
  const roofLines = [76, 94, 112, 130].map(y => {
    const k = ((y - 58) * 70) / 94;
    return `M${106 - k} ${y}H${374 + k}`;
  }).join('');
  const tiles = [
    ...Array.from({ length: 11 }, (_, i) => `M${258 + i * 14} 166V256`),
    ...Array.from({ length: 6 }, (_, i) => `M244 ${180 + i * 14}H410`),
  ].join('');

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block w-full h-auto" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-warm`} cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#ffd27a" stopOpacity=".6" />
          <stop offset="100%" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-living`}><rect x="70" y="272" width="166" height="94" /></clipPath>
        <clipPath id={`${uid}-solar`}><rect x="-2" y="-2" width="124" height="66" rx="3" /></clipPath>
      </defs>

      {/* Sky */}
      <g className="hb-sun" style={{ transformOrigin: '444px 46px' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="442" y="15" width="4" height="10" rx="2" fill="#ffd27a" transform={`rotate(${i * 45} 444 46)`} />
        ))}
      </g>
      <circle cx="444" cy="46" r="15" fill="#ffd27a" />
      <g className="hb-cloud" style={{ animationDuration: '70s', animationDelay: '-20s' }}><Cloud y={22} s={1} /></g>
      <g className="hb-cloud" style={{ animationDuration: '95s', animationDelay: '-70s' }}><Cloud y={6} s={0.7} /></g>

      {/* Ground, a tree and a hedge */}
      <rect x="0" y="376" width={VIEW_W} height="24" fill="#bfe6cf" />
      <rect x="0" y="376" width={VIEW_W} height="3" fill="#a5d9b9" />
      <rect x="455" y="332" width="6" height="46" rx="2" fill="#a86f45" />
      <g className="hb-sway" style={{ transformOrigin: '458px 378px' }}>
        <circle cx="458" cy="318" r="22" fill="#3fae86" />
        <circle cx="444" cy="330" r="14" fill="#4fbf96" />
        <circle cx="471" cy="328" r="13" fill="#2f9e78" />
        <circle cx="454" cy="304" r="11" fill="#62cca4" />
      </g>
      <circle cx="18" cy="370" r="9" fill="#4fbf96" />
      <circle cx="32" cy="367" r="11" fill="#3fae86" />
      <circle cx="46" cy="371" r="8" fill="#4fbf96" />

      {/* Roof */}
      <rect x="138" y="40" width="24" height="52" fill="#0b1f44" />
      <rect x="134" y="36" width="32" height="8" rx="2" fill="#0f2b5b" />
      <path d="M36 152L106 58H374L444 152Z" fill="#0f2b5b" />
      <path d={roofLines} stroke="#1a4a8a" strokeWidth="1.5" />
      <path d="M106 58H374" stroke="#1a4a8a" strokeWidth="5" strokeLinecap="round" />
      <path d="M28 150H452L446 158H34Z" fill="#0b1f44" />

      {/* Shell and rooms */}
      <rect x="58" y="158" width="364" height="220" fill="#e4ddd2" />
      <rect x="70" y="166" width="166" height="96" fill="#f6efe4" />
      <rect x="244" y="166" width="166" height="96" fill="#e9f3f9" />
      <path d={tiles} stroke="#d4e5f0" strokeWidth="1" />
      <rect x="70" y="272" width="166" height="100" fill="#fbf3ea" />
      <rect x="244" y="272" width="166" height="100" fill="#f1ece4" />
      <rect x="70" y="256" width="166" height="6" fill="#d9c3a5" />
      <rect x="244" y="256" width="166" height="6" fill="#c7d9e6" />
      <rect x="70" y="366" width="340" height="6" fill="#d9c3a5" />
      <rect x="58" y="262" width="364" height="10" fill="#cfc6b8" />
      <rect x="236" y="166" width="8" height="200" fill="#cfc6b8" />
      <rect x="54" y="372" width="372" height="8" rx="1" fill="#bdb4a5" />

      {/* Bedroom */}
      <Win x={190} y={180} w={36} h={40} />
      <rect x="82" y="226" width="20" height="30" rx="3" fill="#1a4a8a" />
      <rect x="84" y="238" width="96" height="14" rx="3" fill="#fff" stroke="#e2ddd3" />
      <rect x="104" y="230" width="18" height="10" rx="4" fill="#fff" stroke="#e2ddd3" />
      <rect x="124" y="234" width="56" height="16" rx="4" fill="#00a896" />
      <rect x="84" y="252" width="96" height="4" fill="#0f2b5b" />
      <rect x="196" y="238" width="20" height="18" rx="2" fill="#c98b5a" />
      <path d="M206 238v-7" stroke="#475569" strokeWidth="1.5" />
      <path d="M199 231h14l-3-8h-8Z" fill="#ff6b35" />
      <rect x="70" y="166" width="166" height="96" fill="#9fd4f5" className="hb-fade" style={fade(on('ac'), 0.22)} />

      {/* Bathroom */}
      <path d="M297 166v14h-8" stroke="#94a3b8" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M280 180h18l-3 7h-12Z" fill="#94a3b8" />
      {on('heater') && (
        <g>
          <g stroke="#7cc4f0" strokeWidth="1.6" strokeLinecap="round">
            {[284, 289, 294].map((x, i) => <path key={x} className="hb-drip" style={{ animationDelay: `${i * -0.2}s` }} d={`M${x} 190V226`} />)}
          </g>
          {[270, 300, 326].map((x, i) => (
            <circle key={x} className="hb-steam" style={{ animationDelay: `${i * -0.9}s` }} cx={x} cy="222" r="7" fill="#fff" opacity=".8" />
          ))}
        </g>
      )}
      <rect x="258" y="226" width="78" height="8" rx="4" fill="#fff" stroke="#cbd5e1" />
      <rect x="254" y="230" width="86" height="26" rx="8" fill="#fff" stroke="#cbd5e1" strokeWidth="1.5" />
      <rect x="262" y="254" width="4" height="4" fill="#94a3b8" />
      <rect x="328" y="254" width="4" height="4" fill="#94a3b8" />
      <rect x="342" y="194" width="14" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="344" y="197" width="10" height="28" rx="2" fill="#ff6b35" opacity=".85" />

      {/* Living room */}
      <Win x={84} y={290} w={38} h={36} />
      <rect x="184" y="292" width="36" height="26" rx="2" fill="#fff" stroke="#e2ddd3" />
      <path d="M188 314l10-12 8 8 5-5 7 9Z" fill="#00a896" opacity=".7" />
      <circle cx="210" cy="300" r="3" fill="#ff6b35" />
      <rect x="96" y="334" width="112" height="22" rx="6" fill="#1a4a8a" />
      <rect x="90" y="346" width="124" height="16" rx="5" fill="#0f2b5b" />
      <rect x="86" y="340" width="12" height="24" rx="5" fill="#1a4a8a" />
      <rect x="206" y="340" width="12" height="24" rx="5" fill="#1a4a8a" />
      <rect x="108" y="338" width="20" height="12" rx="3" fill="#ff6b35" />
      <rect x="176" y="338" width="20" height="12" rx="3" fill="#00a896" />
      <rect x="96" y="362" width="3" height="4" fill="#0b1f44" />
      <rect x="205" y="362" width="3" height="4" fill="#0b1f44" />
      <rect x="221" y="352" width="11" height="14" rx="2" fill="#c98b5a" />
      <circle cx="226" cy="346" r="6" fill="#3fae86" />
      <circle cx="222" cy="341" r="4" fill="#4fbf96" />
      <rect x="70" y="272" width="166" height="94" fill="#0f2b5b" className="hb-fade" style={fade(!on('bulb'), 0.2)} />
      <ellipse cx="153" cy="330" rx="110" ry="80" fill={`url(#${uid}-warm)`} clipPath={`url(#${uid}-living)`} className="hb-fade" style={fade(on('bulb'))} />

      {/* Hall */}
      <circle cx="384" cy="292" r="8" fill="#fff" stroke="#cbd5e1" strokeWidth="1.5" />
      <path d="M384 292v-5M384 292h4" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="256" y="338" width="28" height="4" rx="1" fill="#c98b5a" />
      <rect x="258" y="342" width="3" height="24" fill="#a86f45" />
      <rect x="279" y="342" width="3" height="24" fill="#a86f45" />
      <rect x="264" y="326" width="10" height="12" rx="3" fill="#00a896" />
      <rect x="292" y="296" width="62" height="70" rx="2" fill="#fff" stroke="#e2ddd3" />
      <rect x="296" y="300" width="54" height="66" rx="1.5" fill="#c98b5a" />
      <rect x="302" y="306" width="18" height="24" rx="1" fill="#b57a4c" />
      <rect x="326" y="306" width="18" height="24" rx="1" fill="#b57a4c" />
      <rect x="302" y="336" width="18" height="24" rx="1" fill="#b57a4c" />
      <rect x="326" y="336" width="18" height="24" rx="1" fill="#b57a4c" />
      <rect x="290" y="362" width="66" height="4" rx="2" fill="#0f2b5b" opacity=".55" />
      <rect x="368" y="310" width="4" height="7" fill="#475569" />
      <circle cx="370" cy="306" r="4.5" fill="#ffd27a" className="hb-fade" style={fade(on('lock'))} />
      <circle cx="370" cy="306" r="4.5" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />

      {/* Installed products, on top of everything */}
      {PRODUCTS.filter(p => on(p.id)).map(p => (
        <g key={p.id} transform={`translate(${p.at[0]} ${p.at[1]})`}>
          <g className="hb-pop"><ProductArt id={p.id} live clipId={`${uid}-solar`} /></g>
          <circle className="hb-ring" cx={p.box[0] / 2} cy={p.box[1] / 2} r={Math.max(...p.box) / 2 + 4} fill="none" stroke="#00a896" strokeWidth="3" />
        </g>
      ))}
    </svg>
  );
}
