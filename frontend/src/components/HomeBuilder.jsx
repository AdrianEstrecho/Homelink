import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Check, Hand, RotateCcw, ShoppingBag, Sparkles, Wrench } from 'lucide-react';

// "Kit out a HomeLink home": a whole street scene — sky, hills, lawn, sidewalk and road — with a
// cut-away house and a HomeLink delivery truck parked out front, its side rolled up and six
// products on the shelves. Drag a product from the truck onto the house (or tap it, then tap a
// spot). The right spot glows green and the product snaps in and its room comes to life; a wrong
// spot glows red. The HomeLink handyman, up on the truck's roof, reacts to every move in a speech
// bubble. Leave it alone for IDLE_MS and a demo takes over, carrying the remaining products in
// one by one — touching anything hands control straight back.
//
// The scene is one SVG with two compositions: house and truck side by side from lg up, and
// stacked (house above, truck on the road below) on narrower screens. Drop spots and the truck's
// products are HTML buttons laid over the SVG at the same coordinates, which keeps hit-testing,
// focus and labels simple.

const IDLE_MS = 5000;

// Per product: `at`/`box` place the installed artwork in the house's own coordinates (the house
// is drawn in a 480x400 space with its ground at y=376); `hit` is the roomier drop target over it.
const PRODUCTS = [
  { id: 'solar', name: 'Solar Panels', noun: 'solar panels', spot: 'Roof', at: [236, 72], box: [120, 62], hit: [230, 66, 132, 74], done: 'free power from the sun.', hint: 'Solar panels go up on the roof, in the sun.' },
  { id: 'ac', name: 'Air Conditioner', noun: 'air conditioner', spot: 'Bedroom wall', at: [80, 172], box: [96, 34], hit: [76, 166, 104, 48], done: 'the bedroom is cooling down.', hint: 'The aircon goes high on the bedroom wall.' },
  { id: 'heater', name: 'Water Heater', noun: 'water heater', spot: 'Bathroom wall', at: [360, 176], box: [40, 74], hit: [350, 172, 60, 82], done: 'hot showers are on.', hint: 'The water heater goes in the bathroom, next to the shower.' },
  { id: 'bulb', name: 'Smart Bulb', noun: 'smart bulb', spot: 'Ceiling', at: [138, 272], box: [30, 48], hit: [120, 272, 66, 60], done: 'the living room lights up.', hint: 'The smart bulb hangs from the living room ceiling.' },
  { id: 'lock', name: 'Smart Lock', noun: 'smart lock', spot: 'Front door', at: [326, 316], box: [22, 34], hit: [306, 302, 62, 62], done: 'the front door is secured.', hint: 'The smart lock goes on the front door.' },
  { id: 'cctv', name: 'CCTV Camera', noun: 'CCTV camera', spot: 'Outside corner', at: [14, 158], box: [46, 28], hit: [4, 144, 64, 52], labelStart: true, done: 'the yard is being watched.', hint: 'The CCTV camera mounts outside, just under the roof.' },
];
const BY_ID = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));

// The truck's shelf compartments (truck coordinates, 440x270 with the wheels touching y=262),
// filled in PRODUCTS order: top shelf left to right, then the bottom shelf.
const CELLS = [
  [22, 48, 86, 68], [112, 48, 87, 68], [203, 48, 87, 68],
  [22, 125, 86, 64], [112, 125, 87, 64], [203, 125, 87, 64],
];

// Where everything sits in each composition. Bands are the tops of the lawn, sidewalk and road.
const LAYOUTS = {
  wide: {
    w: 1200, h: 600,
    house: { x: 80, y: 50, s: 1.25 },
    truck: { x: 724, y: 318, s: 1.05 },
    sun: [70, 70], hills: [392, 420], grass: 440, walk: 520, road: 534,
    // The handyman stands on the truck's roof; his bubble floats in the sky beside him and grows
    // upward, so a long message never comes down over the house's roof.
    mascot: { left: '80%', bottom: '47%', height: '25%' },
    bubble: { right: '25%', bottom: '64%', width: '25%' },
  },
  tall: {
    w: 480, h: 760,
    house: { x: 0, y: 6, s: 1 },
    truck: { x: 22, y: 468, s: 1 },
    sun: [436, 36], hills: [300, 326], grass: 350, walk: 470, road: 482,
    // No room for the whole handyman: his head and the message sit on the lawn between the two.
    bubble: { left: '3%', right: '3%', top: '50.8%' },
  },
};

const READY = 'Drag a product from the truck onto the house!';
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

const POSES = { info: 'hi', success: 'jump', error: 'thinking' };
const HEADS = { info: 'hi-head', success: 'answer-head', error: 'thinking-head' };

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const WIDE_QUERY = '(min-width: 1024px)';

// A rectangle in a part's own coordinates, as percentages of the whole scene.
const place = (L, origin, [x, y, w, h]) => ({
  left: `${((origin.x + x * origin.s) / L.w) * 100}%`,
  top: `${((origin.y + y * origin.s) / L.h) * 100}%`,
  width: `${((w * origin.s) / L.w) * 100}%`,
  height: `${((h * origin.s) / L.h) * 100}%`,
});

const SLOT_TONES = {
  idle: 'border-white/90 bg-white/25 hover:bg-white/50',
  ready: 'border-brand-orange bg-brand-orange/15',
  good: 'border-brand-teal bg-brand-teal/25 shadow-[0_0_0_4px_rgba(0,168,150,0.25)]',
  bad: 'border-red-500 bg-red-500/20',
};
const LABEL_TONES = {
  idle: 'bg-white text-brand-navy',
  ready: 'bg-brand-orange text-white',
  good: 'bg-brand-teal text-white',
  bad: 'bg-red-500 text-white',
};
const BUBBLE_TONES = {
  info: 'border-white',
  success: 'border-brand-teal',
  error: 'border-red-400',
};

function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}

export default function HomeBuilder() {
  const uid = useId().replace(/:/g, '');
  const wide = useWide();
  const L = wide ? LAYOUTS.wide : LAYOUTS.tall;

  const rootRef = useRef(null);
  const slotRefs = useRef({});
  const itemRefs = useRef({});

  const [installed, setInstalled] = useState({});
  const [selected, setSelected] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const [flash, setFlash] = useState(null);
  const [flight, setFlight] = useState(null);
  const [demo, setDemo] = useState(false);
  const [round, setRound] = useState(0);
  const [message, setMessage] = useState({ tone: 'info', text: READY, key: 0 });

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

  // The handyman's poses swap on every message; fetch them all up front so none of them flickers in.
  useEffect(() => {
    [...Object.values(POSES), ...Object.values(HEADS)].forEach(name => { new Image().src = `/mascot/${name}.webp`; });
  }, []);

  const say = (tone, text) => setMessage(m => ({ tone, text, key: m.key + 1 }));

  const drop = (id, slotId, { auto = false } = {}) => {
    const product = BY_ID[id];
    if (!slotId) {
      say('info', `Drop the ${product.noun} right onto the house.`);
      return false;
    }
    if (slotId !== id) {
      setFlash(slotId);
      setTimeout(() => setFlash(f => (f === slotId ? null : f)), 700);
      itemRefs.current[id]?.animate(
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
    const item = itemRefs.current[id];
    const slot = slotRefs.current[id];
    if (!item || !slot) return;
    if (reducedMotion()) {
      drop(id, id, { auto: true });
      nextStepAt.current = Date.now() + 1500;
      return;
    }
    const a = item.getBoundingClientRect();
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
    drop(id, id, { auto: true });
    nextStepAt.current = Date.now() + 1100;
  };

  // The demo's clock: once the scene has sat in view, untouched, for IDLE_MS, install whatever's
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

  const onItemDown = (e, id) => {
    if (e.button > 0 || installedRef.current[id]) return;
    suppressClick.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false };
  };

  const onItemMove = (e) => {
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
    if (ghostRef.current) ghostRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
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
    if (!cancelled) drop(d.id, hitSlot(e.clientX, e.clientY));
  };

  const onItemClick = (id) => {
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
      say('info', 'Pick a product from the truck first, then tap its spot on the house.');
      return;
    }
    if (drop(selected, slotId)) setSelected(null);
  };

  const targeting = Boolean(dragId || selected || flight);
  const houseCenter = place(L, L.house, [240, 220, 0, 0]);

  const bubbleBody = (
    <>
      <p>{message.text}</p>
      {complete && (
        <span className="mt-2.5 flex flex-wrap gap-2">
          <Link to="/products" className="btn-primary inline-flex items-center gap-1.5 text-xs py-1.5 px-3">
            <ShoppingBag className="w-3.5 h-3.5" /> Shop products
          </Link>
          <Link to="/services" className="btn-secondary inline-flex items-center gap-1.5 text-xs py-1.5 px-3">
            <Wrench className="w-3.5 h-3.5" /> Book an installation
          </Link>
        </span>
      )}
    </>
  );

  return (
    <section
      ref={rootRef}
      aria-labelledby={`${uid}-title`}
      onPointerDownCapture={takeOver}
      onKeyDownCapture={takeOver}
      onPointerMove={noteActivity}
      className="relative overflow-hidden bg-gradient-to-b from-[#bfe1f7] via-[#dcf0fb] to-[#eef8fd]"
    >
      {/* Heading and progress, up in the sky */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-12 md:pt-16 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="max-w-xl">
          <p className="eyebrow mb-2">Try it</p>
          <h2 id={`${uid}-title`} className="section-title">Kit out a HomeLink home</h2>
          <p className="mt-2 text-gray-600 leading-relaxed">
            Everything's on the delivery truck. Drag each product to where it belongs on the house,
            or tap a product and then its spot.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {demo && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-brand-navy shadow-sm">
              <span className="hb-blink w-2 h-2 rounded-full bg-brand-orange" />
              Demo playing. Grab a product to take over
            </span>
          )}
          <span className="inline-flex items-center gap-2.5 rounded-full bg-white/80 pl-3 pr-3.5 py-1.5 shadow-sm">
            <span className="w-20 h-1.5 rounded-full bg-brand-navy/10 overflow-hidden">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-brand-orange to-brand-teal transition-[width] duration-500"
                style={{ width: `${(count / PRODUCTS.length) * 100}%` }}
              />
            </span>
            <span className="text-xs font-semibold tabular-nums text-brand-navy">{count}/{PRODUCTS.length} installed</span>
          </span>
          <button
            type="button"
            onClick={reset}
            disabled={!count}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm hover:text-brand-navy hover:bg-white transition disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Start over
          </button>
        </div>
      </div>

      {/* The scene */}
      <div className="relative mt-4 md:mt-2 max-w-[1400px] mx-auto">
        <Scene L={L} installed={installed} uid={uid} />

        {/* The truck's load. Before the drop spots in the DOM, so keyboard users meet the products
            first and then the spots they go in. */}
        {PRODUCTS.map((p, i) => {
          const done = Boolean(installed[p.id]);
          const style = place(L, L.truck, CELLS[i]);
          if (done) {
            return (
              <span key={p.id} aria-hidden="true" className="absolute flex items-center justify-center rounded-lg border-2 border-dashed border-brand-teal/40" style={style}>
                <span className="w-6 h-6 rounded-full bg-brand-teal text-white flex items-center justify-center shadow">
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </span>
              </span>
            );
          }
          const away = dragId === p.id || flight?.id === p.id;
          return (
            <button
              key={p.id}
              ref={el => { itemRefs.current[p.id] = el; }}
              type="button"
              onPointerDown={e => onItemDown(e, p.id)}
              onPointerMove={onItemMove}
              onPointerUp={e => endDrag(e)}
              onPointerCancel={e => endDrag(e, true)}
              onClick={() => onItemClick(p.id)}
              aria-pressed={selected === p.id}
              aria-label={p.name}
              title={p.name}
              style={style}
              className={`absolute flex flex-col items-center justify-center gap-1 rounded-lg select-none touch-none transition duration-200 cursor-grab active:cursor-grabbing ${
                selected === p.id ? 'bg-brand-orange/15 ring-2 ring-brand-orange' : 'hover:bg-white/70 hover:-translate-y-1'
              } ${away ? 'opacity-30' : ''}`}
            >
              <ProductIcon id={p.id} className="w-[78%] h-[58%] drop-shadow-sm" />
              <span className="hidden lg:block max-w-full truncate rounded bg-white px-1.5 py-px text-[10px] font-semibold text-brand-ink shadow-sm">{p.name}</span>
            </button>
          );
        })}

        {/* Drop spots on the house */}
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
              style={place(L, L.house, p.hit)}
            >
              {tone === 'idle' && <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-lg font-bold leading-none text-brand-navy/40">+</span>}
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

        {/* The handyman and what he has to say */}
        {wide && (
          <span aria-hidden="true" className="pointer-events-none absolute -translate-x-1/2" style={L.mascot}>
            <img
              key={`pose-${message.key}`}
              src={`/mascot/${POSES[message.tone]}.webp`}
              alt=""
              draggable="false"
              className="hb-hop block h-full w-auto"
            />
          </span>
        )}
        <div className="pointer-events-none absolute" style={L.bubble}>
          <div
            key={message.key}
            role="status"
            className={`hb-bubble pointer-events-auto relative flex items-start gap-2.5 rounded-2xl border-2 bg-white px-3.5 py-2.5 text-[13px] lg:text-sm leading-snug text-brand-ink shadow-lg ${BUBBLE_TONES[message.tone]}`}
          >
            {!wide && <img src={`/mascot/${HEADS[message.tone]}.webp`} alt="" aria-hidden="true" className="w-9 h-9 shrink-0 object-contain" />}
            <div className="min-w-0">{bubbleBody}</div>
            {wide && <span aria-hidden="true" className={`absolute bottom-3 -right-[9px] w-4 h-4 rotate-45 border-r-2 border-t-2 bg-white ${BUBBLE_TONES[message.tone]}`} />}
          </div>
        </div>

        {complete && (
          <>
            <span className="pointer-events-none absolute -translate-x-1/2" style={{ left: houseCenter.left, top: '2%' }}>
              <span className="fade-up inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-teal px-3 py-1 text-xs font-bold text-white shadow-md">
                <Sparkles className="w-3.5 h-3.5" /> Fully HomeLinked!
              </span>
            </span>
            <div key={round} aria-hidden="true" className="pointer-events-none absolute" style={{ left: houseCenter.left, top: houseCenter.top }}>
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

// The demo's "hand": carries a product from the truck to its spot along a lifted arc.
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

// ——— The scene ———

function Scene({ L, installed, uid }) {
  const { w, h } = L;
  // Ground bands and hills run well past both edges: the SVG is capped at 1400px wide, and on
  // wider screens they carry on out to the sides of the section.
  const x0 = -1400;
  const x1 = w + 1400;
  const hill = (top, phase) => {
    let d = `M${x0} ${top + 18}`;
    for (let x = x0; x < x1; x += 320) d += `Q${x + 160} ${top - 26 + ((x / 320 + phase) % 2) * 18} ${x + 320} ${top + 18}`;
    return `${d}L${x1} ${L.grass + 20}L${x0} ${L.grass + 20}Z`;
  };
  const joints = [];
  for (let x = x0; x < x1; x += 44) joints.push(`M${x} ${L.walk}v${L.road - L.walk}`);
  const laneY = L.road + (h - L.road) * (L === LAYOUTS.wide ? 0.55 : 0.9);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="relative block w-full h-auto overflow-visible" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-warm`} cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#ffd27a" stopOpacity=".6" />
          <stop offset="100%" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-living`}><rect x="70" y="272" width="166" height="94" /></clipPath>
        <clipPath id={`${uid}-solar`}><rect x="-2" y="-2" width="124" height="66" rx="3" /></clipPath>
      </defs>

      {/* Sky */}
      <g className="hb-sun">
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={L.sun[0] - 2} y={L.sun[1] - 33} width="4" height="11" rx="2" fill="#ffd27a" transform={`rotate(${i * 45} ${L.sun[0]} ${L.sun[1]})`} />
        ))}
      </g>
      <circle cx={L.sun[0]} cy={L.sun[1]} r="17" fill="#ffd27a" />
      {[[30, 1, 80, -10], [8, 0.7, 110, -60], [64, 0.8, 140, -100]].map(([y, s, dur, delay]) => (
        <g key={delay} className="hb-cloud" style={{ '--cloud-to': `${w + 120}px`, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}>
          <Cloud y={y} s={s} />
        </g>
      ))}

      {/* Hills, lawn, sidewalk, road */}
      <path d={hill(L.hills[0], 0)} fill="#d3ecd9" />
      <path d={hill(L.hills[1], 1)} fill="#c2e6cc" />
      <rect x={x0} y={L.grass} width={x1 - x0} height={L.walk - L.grass} fill="#b3dfc0" />
      <rect x={x0} y={L.walk} width={x1 - x0} height={L.road - L.walk} fill="#e7e2d8" />
      <path d={joints.join('')} stroke="#d6cfc2" strokeWidth="1.5" />
      <rect x={x0} y={L.road} width={x1 - x0} height={h - L.road} fill="#1c2536" />
      <rect x={x0} y={L.road} width={x1 - x0} height="3" fill="#cfc8ba" />
      <path d={`M${x0} ${laneY}H${x1}`} stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeDasharray="28 24" />
      {L === LAYOUTS.wide && <Tree x={34} ground={L.walk} h={96} />}

      <g transform={`translate(${L.house.x} ${L.house.y}) scale(${L.house.s})`}>
        <House installed={installed} uid={uid} />
      </g>
      <g transform={`translate(${L.truck.x} ${L.truck.y}) scale(${L.truck.s})`}>
        <Truck />
      </g>
    </svg>
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

function Tree({ x, ground, h }) {
  return (
    <g>
      <rect x={x - 3} y={ground - h * 0.5} width="6" height={h * 0.5} rx="2" fill="#a86f45" />
      <g className="hb-sway">
        <circle cx={x} cy={ground - h * 0.64} r={h * 0.3} fill="#3fae86" />
        <circle cx={x - h * 0.17} cy={ground - h * 0.52} r={h * 0.21} fill="#4fbf96" />
        <circle cx={x + h * 0.18} cy={ground - h * 0.55} r={h * 0.2} fill="#2f9e78" />
        <circle cx={x - h * 0.06} cy={ground - h * 0.78} r={h * 0.15} fill="#62cca4" />
      </g>
    </g>
  );
}

// The HomeLink box truck, parked with its side shutter rolled up. Facing right, cab at the front.
function Truck() {
  return (
    <g>
      <ellipse cx="220" cy="263" rx="214" ry="7" fill="#0b1324" opacity=".25" />

      {/* Cargo box */}
      <rect x="6" y="0" width="300" height="218" rx="12" fill="#0f2b5b" />
      <text x="156" y="16" textAnchor="middle" fontFamily="Archivo, system-ui, sans-serif" fontWeight="800" fontSize="14" fill="#fff">
        Home<tspan fill="#ff6b35">Link</tspan>
        <tspan fontSize="9" fontWeight="700" fill="#9fc3ea" dx="6" letterSpacing="1.5">DELIVERY</tspan>
      </text>
      <rect x="20" y="46" width="272" height="150" rx="4" fill="#e8edf3" />
      <rect x="20" y="46" width="272" height="10" fill="#0f2b5b" opacity=".08" />
      <path d="M110 46V191M201 46V191" stroke="#cbd5e1" strokeWidth="3" />
      <rect x="20" y="118" width="272" height="5" fill="#c98b5a" />
      <rect x="20" y="191" width="272" height="5" fill="#c98b5a" />
      <rect x="14" y="22" width="284" height="24" rx="6" fill="#e2e8f0" />
      <path d="M18 28h276M18 34h276M18 40h276" stroke="#cbd5e1" strokeWidth="1.5" />
      <rect x="140" y="42" width="32" height="5" rx="2" fill="#94a3b8" />
      <rect x="6" y="200" width="300" height="8" fill="#ff6b35" />
      <rect x="0" y="168" width="7" height="16" rx="2" fill="#ffb020" className="hb-blink" />

      {/* Cab */}
      <path d="M306 218V96a10 10 0 0 1 10-10h62a14 14 0 0 1 11.8 6.5L422 144a8 8 0 0 0 5 3h1a8 8 0 0 1 8 8V218Z" fill="#ff6b35" />
      <path d="M346 98h28a8 8 0 0 1 6.8 3.8L404 140h-58Z" fill="#bfe3ff" />
      <path d="M357 103l-6 28" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".6" />
      <path d="M340 104v108" stroke="#c8461a" strokeWidth="1.5" />
      <rect x="312" y="150" width="22" height="22" rx="5" fill="#0f2b5b" />
      <path d="M317 163l6-5 6 5v6h-12Z" fill="#fff" />
      <rect x="346" y="152" width="10" height="3.5" rx="1.5" fill="#c8461a" />
      <rect x="428" y="160" width="8" height="11" rx="2" fill="#fde68a" />
      <circle cx="432" cy="152" r="3" fill="#ffb020" className="hb-blink" />
      <rect x="420" y="206" width="20" height="10" rx="3" fill="#cbd5e1" />
      <rect x="306" y="200" width="122" height="8" fill="#e85a28" />

      {/* Chassis and wheels */}
      <rect x="10" y="214" width="420" height="14" rx="4" fill="#0b1f44" />
      {[70, 128, 368].map(cx => (
        <g key={cx}>
          <path d={`M${cx - 30} 236a30 30 0 0 1 60 0Z`} fill="#0b1f44" />
          <circle cx={cx} cy="236" r="26" fill="#1f2937" />
          <circle cx={cx} cy="236" r="12" fill="#cbd5e1" />
          <circle cx={cx} cy="236" r="4" fill="#64748b" />
        </g>
      ))}
    </g>
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

// ——— The house: a cut-away with the front wall off, so the rooms each product belongs in show.
// Drawn in a 480x400 space with its ground at y=376; the scene places and scales it. ———

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

function House({ installed, uid }) {
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
    <g>
      {/* A tree and a hedge either side */}
      <Tree x={458} ground={378} h={80} />
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
    </g>
  );
}
