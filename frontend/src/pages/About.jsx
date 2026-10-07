import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ShieldCheck, HeartHandshake, Target, Sparkles, Home as HomeIcon, Wrench, Expand, Shield, Truck, Star,
  ShoppingCart, Search, CalendarClock, AlertTriangle, Package, CreditCard, PackageCheck, Check, X,
} from 'lucide-react';
import { api } from '../api/client';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import CountUp from '../components/CountUp';
import SafeImage from '../components/SafeImage';
import SplitText from '../components/SplitText';
import GalleryLightbox from '../components/GalleryLightbox';
import { GallerySkeleton } from '../components/Skeleton';
import { LogoMark } from '../components/brand/Logo';
import { getCategoryIcon } from '../constants/categoryIcons';
import { useReveal } from '../hooks/useReveal';
import { useTilt } from '../hooks/useTilt';

const STATS = [
  { value: '10,000+', label: 'Homeowners served' },
  { value: '500+', label: 'Products available' },
  { value: '50+', label: 'Verified technicians' },
  { value: '4.8/5', label: 'Average rating' },
];

// What circles the house in the hero; each one opens that category on /products.
const ORBIT = [
  { slug: 'air-conditioners', label: 'Air conditioning' },
  { slug: 'solar-panels', label: 'Solar' },
  { slug: 'cctv-security', label: 'CCTV & security' },
  { slug: 'plumbing', label: 'Plumbing' },
  { slug: 'electrical', label: 'Electrical' },
  { slug: 'smart-home', label: 'Smart home' },
];

// The story's before-and-after, told as the steps a homeowner goes through.
const OLD_WAY = [
  { icon: ShoppingCart, text: 'Buy the unit from one store' },
  { icon: Search, text: 'Hunt for an installer somewhere else' },
  { icon: CalendarClock, text: 'Line up delivery and installation yourself' },
  { icon: AlertTriangle, text: 'Hope the two actually meet' },
];
const HOMELINK_WAY = [
  { icon: Package, text: 'Pick the product you need' },
  { icon: ShieldCheck, text: 'Add a verified technician to install it' },
  { icon: CreditCard, text: 'Book both in a single checkout' },
  { icon: PackageCheck, text: 'Track it from order to a finished job' },
];

const VALUES = [
  { icon: ShieldCheck, title: 'Trust, verified', desc: 'Every technician on HomeLink is background-checked and trained before they ever step into your home.' },
  { icon: Sparkles, title: 'Quality first', desc: 'We curate products from brands we trust, and hold every installation to the same high standard.' },
  { icon: HeartHandshake, title: 'Customer-obsessed', desc: 'From browsing to booking to follow-up, we design every step around what makes your life easier.' },
  { icon: Target, title: 'One platform', desc: 'Products and professional installation in one place, so you never have to coordinate between vendors.' },
];

const PROMISES = [
  { icon: Shield, title: 'Verified Technicians', desc: 'All service providers are verified and trained professionals, background-checked before they ever step into your home.' },
  { icon: Truck, title: 'Reliable Delivery', desc: 'Track your orders from purchase to doorstep delivery, with real-time updates every step of the way.' },
  { icon: Wrench, title: 'Expert Services', desc: 'Book installation, cleaning, and repair services easily, with pros matched to the job you need done.' },
  { icon: Star, title: 'Quality Products', desc: 'Curated home improvement products from trusted brands, vetted for durability and performance.' },
];

const DEFAULT_HERO = {
  heading: 'Home improvement, done right',
  intro: 'HomeLink brings home improvement products and the professionals who install them into one place, so homeowners can shop, book, and get the job done without juggling multiple vendors.',
};

export default function About() {
  const [items, setItems] = useState({ data: [], loading: true, error: false });
  const [category, setCategory] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [hero, setHero] = useState(DEFAULT_HERO);
  const [activePromise, setActivePromise] = useState(0);
  const tilt = useTilt();

  const loadItems = useCallback(() => {
    setItems(s => ({ ...s, loading: true, error: false }));
    api.get('/gallery')
      .then(data => setItems({ data, loading: false, error: false }))
      .catch(() => setItems({ data: [], loading: false, error: true }));
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => {
    api.get('/promos/about-hero')
      .then(data => setHero({ heading: data.heading || DEFAULT_HERO.heading, intro: data.intro || DEFAULT_HERO.intro }))
      .catch(() => {});
  }, []);

  const categories = useMemo(() => [...new Set(items.data.map(g => g.category).filter(Boolean))], [items.data]);
  const filtered = useMemo(() => category ? items.data.filter(g => g.category === category) : items.data, [items.data, category]);

  return (
    <div>
      {/* Hero — the CMS heading and intro beside the service orbit, with the stats underneath. */}
      <section className="relative overflow-hidden pt-14 pb-16 md:pt-20 md:pb-24">
        <div className="about-grid absolute inset-0 pointer-events-none" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-10 items-center">
          <div className="text-center lg:text-left">
            <p className="eyebrow justify-center lg:justify-start mb-4"><HomeIcon className="w-3.5 h-3.5" /> About HomeLink</p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.05] text-brand-ink mb-5">
              <SplitText key={hero.heading} text={hero.heading} />
            </h1>
            <p className="fade-up text-gray-500 text-lg leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8" style={{ animationDelay: '250ms' }}>{hero.intro}</p>
            <div className="fade-up flex flex-wrap justify-center lg:justify-start gap-3 mb-10" style={{ animationDelay: '380ms' }}>
              <Link to="/products" className="btn-primary inline-flex items-center gap-2">Browse products <ArrowRight className="w-4 h-4" /></Link>
              <Link to="/services" className="btn-outline inline-flex items-center gap-2">Book a service</Link>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-6 border-t border-gray-200/80 pt-6 text-left">
              {STATS.map((s, i) => (
                <div key={s.label} className="flex flex-col-reverse justify-end sm:px-4 sm:first:pl-0 sm:border-l sm:first:border-l-0 border-gray-200/80">
                  <dt className="text-xs text-gray-500 mt-1">{s.label}</dt>
                  <dd><CountUp value={s.value} delay={i * 100} className="font-display text-2xl md:text-3xl font-extrabold text-brand-navy tabular-nums" /></dd>
                </div>
              ))}
            </dl>
          </div>
          <Reveal className="flex justify-center">
            <ServiceOrbit />
          </Reveal>
        </div>
      </section>

      {/* Story — the why, and the before-and-after it's about. */}
      <section className="bg-brand-light py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <Reveal>
            <p className="eyebrow mb-3">Our Story</p>
            <h2 className="section-title mb-5"><SplitText text="Why we started HomeLink" /></h2>
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>
                Buying an air conditioner is easy. Finding someone reliable to install it, on time and without
                surprises, is the hard part. HomeLink started with that gap: homeowners were left stitching
                together a purchase from one place and an installer from somewhere else, hoping the two would
                line up.
              </p>
              <p>
                We built HomeLink so that doesn't have to happen. Every product we list can be paired with a
                verified technician, booked in a few clicks, tracked from order to completed job. It's the
                platform we wished existed when we were the ones waiting around for an installer.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <BeforeAfter />
          </Reveal>
        </div>
      </section>

      {/* Promise — expanding panels: hovering, focusing, or tapping one widens
          it and reveals its description while the others collapse. */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-brand-navy to-brand-blue">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center max-w-xl mx-auto mb-10">
            <p className="eyebrow justify-center mb-3">Why HomeLink</p>
            <h2 className="section-title text-white"><SplitText text="The HomeLink promise" /></h2>
          </Reveal>
          <Reveal>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:h-[240px]">
              {PROMISES.map((f, i) => {
                const isOpen = activePromise === i;
                return (
                  <button
                    key={f.title}
                    type="button"
                    onClick={() => setActivePromise(i)}
                    onMouseEnter={() => setActivePromise(i)}
                    onFocus={() => setActivePromise(i)}
                    aria-expanded={isOpen}
                    className={`group relative text-left rounded-2xl border p-5 flex flex-col justify-between overflow-hidden transition-all duration-500 ease-in-out ${
                      isOpen
                        ? 'sm:flex-[2.6] bg-gradient-to-br from-white/[0.14] to-white/[0.04] border-white/20'
                        : 'sm:flex-1 bg-white/[0.03] border-white/10 hover:bg-white/[0.07]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-500 ${isOpen ? 'bg-brand-orange/25' : 'bg-white/10 group-hover:bg-white/15'}`}>
                        <f.icon className={`w-4 h-4 transition-colors duration-500 ${isOpen ? 'text-brand-orange' : 'text-white/70'}`} />
                      </div>
                      <span className={`font-display font-black tabular-nums transition-all duration-500 ${isOpen ? 'text-2xl md:text-3xl text-white/30' : 'text-base text-white/20'}`}>
                        .{String(i + 1).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="mt-4">
                      <h3 className={`font-display font-bold text-white transition-all duration-500 ${isOpen ? 'text-lg mb-1.5' : 'text-sm'}`}>
                        {f.title}
                      </h3>
                      <div className="grid transition-[grid-template-rows] duration-500 ease-in-out" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
                        <div className="overflow-hidden">
                          <p className="text-white/70 text-sm leading-relaxed max-w-xs">{f.desc}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-24 bg-brand-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center max-w-xl mx-auto mb-12">
            <p className="eyebrow justify-center mb-3">What We Stand For</p>
            <h2 className="section-title"><SplitText text="The values behind HomeLink" /></h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 80} className="h-full">
                <div {...tilt} className="card tilt group relative h-full p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-11 h-11 rounded-xl bg-brand-navy/5 flex items-center justify-center transition-all duration-300 group-hover:bg-brand-orange group-hover:-rotate-6 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-brand-orange/30">
                      <v.icon className="w-5 h-5 text-brand-orange transition-colors duration-300 group-hover:text-white" />
                    </div>
                    <span className="font-display font-black text-sm text-gray-300 tabular-nums">0{i + 1}</span>
                  </div>
                  <h3 className="font-display font-bold text-brand-ink mb-2">{v.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
                  <span className="tilt-glare" aria-hidden="true" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery — a bento grid led by one large photo; the filter's pill slides between
          categories and the grid replays its entrance for each. */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center max-w-xl mx-auto mb-10">
            <p className="eyebrow justify-center mb-3">Our Work</p>
            <h2 className="section-title mb-2"><SplitText text="Project Gallery" /></h2>
            <p className="text-gray-500">A look at completed installations and repairs from our verified technicians.</p>
          </Reveal>

          {categories.length > 0 && (
            <GalleryFilter categories={categories} value={category} onChange={setCategory} />
          )}

          {items.loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => <GallerySkeleton key={i} />)}
            </div>
          ) : items.error ? (
            <ErrorState message="Couldn't load the gallery right now." onRetry={loadItems} />
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No projects to show yet — check back soon.</p>
          ) : (
            <div key={category || 'all'} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-[240px] gap-4 sm:gap-5">
              {filtered.map((g, i) => (
                <Reveal key={g.id} delay={(i % 6) * 60} className={i === 0 && filtered.length >= 3 ? 'sm:col-span-2 sm:row-span-2' : ''}>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    aria-label={`View ${g.title}`}
                    className="group relative block w-full h-full overflow-hidden rounded-2xl bg-gray-100 text-left shadow-[0_4px_24px_-8px_rgba(15,43,91,0.15)]"
                  >
                    <SafeImage src={g.image} alt={g.title} className="w-full h-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/85 via-brand-navy/10 to-transparent opacity-80 group-hover:opacity-100 transition duration-500" />
                    <span className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 flex items-center justify-center opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition duration-300">
                      <Expand className="w-4 h-4 text-white" />
                    </span>
                    <div className="absolute bottom-0 left-0 right-0 p-5 transition-transform duration-500 group-hover:-translate-y-1">
                      {g.category && <span className="badge bg-brand-teal text-white mb-2">{g.category}</span>}
                      <h3 className={`font-display font-bold text-white leading-snug ${i === 0 && filtered.length >= 3 ? 'sm:text-2xl' : ''}`}>{g.title}</h3>
                    </div>
                  </button>
                </Reveal>
              ))}
            </div>
          )}

          {lightboxIndex !== null && (
            <GalleryLightbox
              items={filtered}
              index={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
              onNavigate={setLightboxIndex}
            />
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20 md:py-24 bg-brand-navy text-white">
        <div className="absolute inset-0 opacity-[0.18] pointer-events-none" aria-hidden="true">
          <div className="float-blob absolute -top-16 left-1/3 w-80 h-80 bg-brand-orange rounded-full blur-3xl" />
          <div className="float-blob-delayed absolute -bottom-24 right-1/4 w-80 h-80 bg-brand-teal rounded-full blur-3xl" />
        </div>
        <Reveal className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight mb-5"><SplitText text="Let's get your home sorted" /></h2>
          <p className="text-gray-300 mb-10 max-w-lg mx-auto">Browse products or book a verified technician, and see why homeowners choose HomeLink.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/products" className="inline-flex items-center border border-white/25 text-white hover:bg-white/10 hover:border-white/40 font-semibold px-6 py-2.5 rounded-lg transition-all text-sm">Browse Products</Link>
            <Link to="/services" className="btn-primary inline-flex items-center gap-2">Book a Service <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

// The HomeLink mark with the kinds of work HomeLink covers circling it (.about-orbit in
// index.css). The ring turns while each chip counter-turns to stay upright; pointing at it
// pauses the ring so a chip can be picked, and each opens that category of products.
function ServiceOrbit() {
  return (
    <div className="about-orbit relative w-72 h-72 sm:w-[24rem] sm:h-[24rem]">
      <div className="absolute inset-[13%] rounded-full border border-dashed border-brand-navy/20" aria-hidden="true" />
      <div className="absolute inset-[3%] rounded-full bg-gradient-to-br from-brand-orange/[0.07] via-transparent to-brand-teal/[0.07]" aria-hidden="true" />
      <span className="about-pulse absolute inset-[31%] rounded-[2rem] bg-brand-orange/25" aria-hidden="true" />
      <div className="group absolute inset-[31%] rounded-[2rem] bg-gradient-to-br from-brand-navy to-brand-blue shadow-[0_24px_50px_-18px_rgba(15,43,91,0.6)] flex items-center justify-center">
        <LogoMark className="w-[62%] text-white" />
      </div>
      <ul className="about-orbit-track absolute inset-0">
        {ORBIT.map((o, i) => {
          const Icon = getCategoryIcon(o.slug);
          const angle = (360 / ORBIT.length) * i;
          return (
            <li key={o.slug} className="absolute inset-0 pointer-events-none" style={{ transform: `rotate(${angle}deg)` }}>
              <div className="absolute left-1/2 top-[13%] w-0 h-0">
                <div style={{ transform: `rotate(${-angle}deg)` }}>
                  <div className="about-orbit-upright">
                    <Link
                      to={`/products?category=${o.slug}`}
                      aria-label={`Shop ${o.label}`}
                      className="about-orbit-chip group pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white border border-gray-100 shadow-[0_10px_24px_-10px_rgba(15,43,91,0.35)] flex items-center justify-center transition duration-300 hover:bg-brand-orange hover:border-brand-orange hover:scale-110 focus-visible:bg-brand-orange"
                    >
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-brand-navy transition-colors duration-300 group-hover:text-white group-focus-visible:text-white" />
                      <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-navy px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 -translate-y-1 transition duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 pointer-events-none">
                        {o.label}
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// "The old way" against "With HomeLink", as the steps a homeowner takes. It shows the old way
// first and switches over on its own once it's been on screen a moment, unless someone has
// already picked a side. The steps replay their entrance on every switch (.compare-step).
function BeforeAfter() {
  const [withHomeLink, setWithHomeLink] = useState(false);
  const touched = useRef(false);
  const [ref, inView] = useReveal();

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => { if (!touched.current) setWithHomeLink(true); }, 2200);
    return () => clearTimeout(t);
  }, [inView]);

  const pick = (value) => {
    touched.current = true;
    setWithHomeLink(value);
  };
  const steps = withHomeLink ? HOMELINK_WAY : OLD_WAY;

  return (
    <div ref={ref} className="card p-5 sm:p-7">
      <div role="tablist" aria-label="Compare" className="relative grid grid-cols-2 p-1 rounded-full bg-brand-light border border-gray-200/70">
        <span
          aria-hidden="true"
          className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full shadow-sm transition-all duration-500 ease-[cubic-bezier(0.2,0.9,0.2,1)] ${withHomeLink ? 'translate-x-full bg-brand-navy' : 'bg-white'}`}
        />
        {[[false, 'The old way'], [true, 'With HomeLink']].map(([value, label]) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={withHomeLink === value}
            onClick={() => pick(value)}
            className={`relative z-10 py-2 text-sm font-semibold rounded-full transition-colors duration-300 ${
              withHomeLink === value ? (value ? 'text-white' : 'text-brand-navy') : 'text-gray-500 hover:text-brand-navy'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ol key={String(withHomeLink)} className="mt-6 space-y-3" role="tabpanel">
        {steps.map((s, i) => (
          <li
            key={s.text}
            className={`compare-step flex items-center gap-4 rounded-xl border p-3.5 sm:p-4 ${withHomeLink ? 'border-brand-orange/20 bg-brand-orange/[0.04]' : 'border-gray-200/80 bg-white/60'}`}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${withHomeLink ? 'bg-brand-orange text-white shadow-md shadow-brand-orange/25' : 'bg-gray-100 text-gray-400'}`}>
              <s.icon className="w-5 h-5" />
            </span>
            <span className={`text-sm sm:text-[15px] font-medium ${withHomeLink ? 'text-brand-ink' : 'text-gray-500'}`}>{s.text}</span>
            <span className={`ml-auto w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${withHomeLink ? 'bg-brand-teal/15 text-brand-teal' : 'bg-red-50 text-red-400'}`}>
              {withHomeLink ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <X className="w-3.5 h-3.5" strokeWidth={3} />}
            </span>
          </li>
        ))}
      </ol>
      <p key={`note-${withHomeLink}`} className="compare-step mt-5 text-sm text-gray-500" style={{ animationDelay: '380ms' }}>
        {withHomeLink ? 'One order, one schedule, and one place to check on it.' : 'Two vendors, two schedules, and you stuck in the middle.'}
      </p>
    </div>
  );
}

// The category filter above the gallery: one pill slides to the selected category.
function GalleryFilter({ categories, value, onChange }) {
  const rowRef = useRef(null);
  const pillRef = useRef(null);

  useLayoutEffect(() => {
    const place = () => {
      const active = rowRef.current?.querySelector('[aria-pressed="true"]');
      const pill = pillRef.current;
      if (!active || !pill) return;
      // The first placement jumps there rather than sliding in from the left edge.
      const first = !pill.dataset.placed;
      if (first) pill.style.transition = 'none';
      pill.style.width = `${active.offsetWidth}px`;
      pill.style.height = `${active.offsetHeight}px`;
      pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop - 4}px)`;
      if (first) {
        void pill.offsetWidth;
        pill.style.transition = '';
        pill.dataset.placed = '1';
      }
    };
    place();
    document.fonts?.ready.then(place);
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [value, categories]);

  return (
    <div className="flex justify-center mb-8">
      <div ref={rowRef} className="relative inline-flex flex-wrap justify-center gap-1 p-1 rounded-3xl bg-brand-light border border-gray-200/70 max-w-full">
        <span ref={pillRef} aria-hidden="true" className="gallery-pill absolute top-1 left-0 rounded-full bg-brand-navy shadow-sm" />
        {['', ...categories].map(c => (
          <button
            key={c || 'all'}
            type="button"
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            className={`relative z-10 px-4 py-1.5 text-sm font-medium rounded-full transition-colors duration-300 ${value === c ? 'text-white' : 'text-gray-500 hover:text-brand-navy'}`}
          >
            {c || 'All'}
          </button>
        ))}
      </div>
    </div>
  );
}
