import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, User, Star } from 'lucide-react';
import { formatPrice } from '../api/client';
import { getCategoryIcon } from '../constants/categoryIcons';
import SafeImage from './SafeImage';
import HeroSky from './HeroSky';

// Cards fade out by this --progress value (see .hero-product opacity in
// index.css); past it they're hidden outright so the invisible links behind
// the house can't be clicked or tabbed to.
const CARDS_HIDDEN_AT = 0.8;

// The hero sits right under the "Homeowners Served" pill, so a
// "3.5 (2)" there undercuts it. Only well-established, well-rated scores are
// shown here; the product page still shows every rating as-is.
const HERO_MIN_REVIEWS = 5;
const HERO_MIN_RATING = 4;

// Most a hovered card leans toward the cursor, in degrees per axis.
const MAX_TILT = 8;
// More chips than this would run into the inner card column beside the copy.
const MAX_CHIPS = 3;

// The broad category ("Air Conditioners") rather than the subcategory ("Split
// Type"), falling back to the latter if the API predates main_category_*.
const categorySlugOf = (p) => p.main_category_slug || p.category_slug;
const categoryNameOf = (p) => p.main_category_name || p.category_name;

function HeroRating({ product }) {
  if (!(product.review_count >= HERO_MIN_REVIEWS && Number(product.avg_rating) >= HERO_MIN_RATING)) return null;
  return (
    <span className="flex items-center gap-1 text-[11px] text-gray-400">
      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
      <span className="font-semibold text-gray-600">{Number(product.avg_rating).toFixed(1)}</span>
      ({product.review_count})
    </span>
  );
}

// The whole card links to the product page, so the badge is an arrow rather
// than a cart icon, which would promise an add-to-cart the click doesn't do.
function ViewBadge() {
  return (
    <span className="w-8 h-8 rounded-full bg-brand-orange text-white flex items-center justify-center shrink-0 shadow-sm" aria-hidden="true">
      <ArrowUpRight className="w-4 h-4" />
    </span>
  );
}

// Product cards flanking the hero copy. Odd slots are tall cards, even slots
// compact rows; slots 1-4 are the front layer and 5-8 a smaller back layer
// tucked behind them. Position and scroll travel live in index.css
// (.hero-product--N), so each breakpoint can show and rearrange a subset.
// With a mouse, a hovered card tilts toward the cursor with a moving glare;
// the angles go straight onto the card's style (--rx/--ry/--gx/--gy) rather
// than through state, so tracking the cursor never re-renders anything.
function HeroProductCard({ product, index, lit, tilt, onHoverChange }) {
  const compact = index % 2 === 1;
  const cardRef = useRef(null);

  const onPointerMove = (e) => {
    if (!tilt || e.pointerType !== 'mouse' || !cardRef.current) return;
    // Measured on the link, not the card itself, which is the thing being
    // tilted — its own box would shift under the cursor as it leans.
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const style = cardRef.current.style;
    style.setProperty('--ry', `${((x - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
    style.setProperty('--rx', `${((0.5 - y) * 2 * MAX_TILT).toFixed(2)}deg`);
    style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
    style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
  };
  const onPointerLeave = () => {
    cardRef.current?.style.removeProperty('--rx');
    cardRef.current?.style.removeProperty('--ry');
  };

  const slug = categorySlugOf(product);
  return (
    <Link
      to={`/products/${product.slug}`}
      className={`hero-product hero-product--${index + 1}${lit ? ' is-lit' : ''}`}
      aria-label={`${product.name}, ${formatPrice(product.price)}`}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onMouseEnter={() => onHoverChange(slug)}
      onMouseLeave={() => onHoverChange(null)}
      onFocus={() => onHoverChange(slug)}
      onBlur={() => onHoverChange(null)}
    >
      <div className="fade-up" style={{ animationDelay: `${360 + index * 120}ms` }}>
        <div className="hero-product-float" style={{ animationDelay: `${index * -1.6}s` }}>
          {compact ? (
            <div ref={cardRef} className="hero-product-card hero-product-card--compact flex items-center gap-3">
              <SafeImage src={product.image} alt="" className="w-14 h-14 rounded-xl object-cover bg-gray-100 shrink-0" iconClassName="w-5 h-5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand-ink leading-snug line-clamp-2">{product.name}</p>
                <HeroRating product={product} />
                <p className="text-sm font-bold text-brand-navy">{formatPrice(product.price)}</p>
              </div>
              <ViewBadge />
            </div>
          ) : (
            <div ref={cardRef} className="hero-product-card hero-product-card--tall">
              <div className="relative">
                <SafeImage src={product.image} alt="" className="hero-product-img w-full rounded-xl object-cover bg-gray-100" iconClassName="w-6 h-6" />
                {product.featured && (
                  <span className="absolute top-2 left-2 badge bg-brand-orange text-white gap-1 shadow-sm">
                    <Star className="w-3 h-3" /> Featured
                  </span>
                )}
              </div>
              <div className="px-1 pt-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-teal truncate">{product.category_name}</p>
                <p className="text-sm font-semibold text-brand-ink leading-snug line-clamp-2 mt-0.5">{product.name}</p>
                <HeroRating product={product} />
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="font-bold text-brand-navy">{formatPrice(product.price)}</span>
                  <ViewBadge />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// Fallback colours for buyers without a profile photo, one per avatar slot.
const BUYER_GRADIENTS = [
  'from-sky-400 to-brand-navy',
  'from-amber-300 to-brand-orange',
  'from-emerald-300 to-brand-teal',
];

// "N Homeowners Served" with the faces of real customers who've bought (GET
// /customers/served). Its slot keeps the pill's height while that loads, so
// the headline doesn't jump down when it arrives; with no buyers yet (or a
// failed request) the slot just stays empty rather than showing a made-up count.
function ServedPill({ served }) {
  const count = served?.count ?? 0;
  return (
    <div className="h-[38px] mb-4">
      {count > 0 && (
        <div className="fade-up inline-flex items-center gap-2.5 bg-gradient-to-br from-white/[0.24] to-white/[0.06] backdrop-blur-md border border-white/25 rounded-full pl-2 pr-4 py-1.5 text-sm font-semibold text-white/90">
          <span className="flex -space-x-2 shrink-0">
            {served.buyers.map((b, i) => (
              <span
                key={i}
                title={b.name}
                className={`w-6 h-6 rounded-full ring-2 ring-white bg-gradient-to-br ${BUYER_GRADIENTS[i % BUYER_GRADIENTS.length]} flex items-center justify-center overflow-hidden text-[9px] font-bold text-white`}
              >
                {b.avatar ? <img src={b.avatar} alt="" className="w-full h-full object-cover" />
                  : b.initials || <User className="w-3 h-3" />}
              </span>
            ))}
          </span>
          {count.toLocaleString()} {count === 1 ? 'Homeowner' : 'Homeowners'} Served
        </div>
      )}
    </div>
  );
}

export default function Hero({ products = [], served = null }) {
  const wrapRef = useRef(null);
  const pinRef = useRef(null);
  // The background footage is near-invisible by design (see .hero-video), so
  // it's skipped where it costs the most for the least: small screens, where
  // it would pull a ~40MB loop over mobile data, and reduced-motion users.
  const [showVideo] = useState(() =>
    window.matchMedia('(min-width: 900px) and (prefers-reduced-motion: no-preference)').matches
  );
  const [tilt] = useState(() =>
    window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches
  );
  // The category being pointed at, from either a chip or a card. A chip
  // spotlights its cards (dimming the rest); a card just lights up its chip.
  const [spot, setSpot] = useState(null);

  const heroProducts = products.slice(0, 8);
  const categories = useMemo(() => {
    const seen = new Map();
    for (const p of products.slice(0, 8)) {
      const slug = categorySlugOf(p);
      if (slug && !seen.has(slug)) seen.set(slug, categoryNameOf(p));
    }
    return [...seen].slice(0, MAX_CHIPS).map(([slug, name]) => ({ slug, name }));
  }, [products]);
  const spotlight = spot?.from === 'chip' ? spot.slug : null;

  useEffect(() => {
    const wrap = wrapRef.current;
    const pin = pinRef.current;
    if (!wrap || !pin) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let ticking = false;
    let cardsHidden = false;
    // Decelerating curve so the house's growth settles into place near the end
    // of the scroll range instead of scaling at a constant, mechanical rate.
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const update = () => {
      ticking = false;
      const rect = wrap.getBoundingClientRect();
      const scrollable = wrap.offsetHeight - pin.offsetHeight;
      const raw = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;
      const progress = easeOutCubic(raw);
      pin.style.setProperty('--progress', progress.toFixed(4));
      const hidden = progress >= CARDS_HIDDEN_AT;
      if (hidden !== cardsHidden) {
        cardsHidden = hidden;
        pin.toggleAttribute('data-cards-hidden', hidden);
      }
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div className="hero-wrap" ref={wrapRef}>
      <section className="hero-pin" ref={pinRef} data-spotlight={spotlight ?? undefined}>
        {showVideo && (
          <video className="hero-video" src="/Homepage.mp4" autoPlay muted loop playsInline aria-hidden="true" />
        )}
        <HeroSky pinRef={pinRef} />
        <div className="hero-horizon" aria-hidden="true" />
        <div className="hero-copy">
          <ServedPill served={served} />

          <h1
            className="fade-up font-display font-extrabold tracking-tightest [word-spacing:0.12em] leading-[0.98] text-white mb-4 text-[clamp(2rem,5vw,3.75rem)]"
            style={{ animationDelay: '90ms' }}
          >
            Shop products.<br />Book services.
          </h1>

          <p className="fade-up text-base text-gray-300 max-w-lg mx-auto mb-6 leading-relaxed" style={{ animationDelay: '180ms' }}>
            Everything you need to upgrade your home — quality products and verified technicians, all in one place.
          </p>

          <div className="fade-up flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '270ms' }}>
            <Link
              to="/products"
              className="group inline-flex items-center gap-3 bg-brand-orange hover:bg-orange-600 text-white font-semibold pl-6 pr-2 py-2 rounded-full transition shadow-sm hover:shadow-md"
            >
              Browse Products
              <span className="w-9 h-9 rounded-full bg-white text-brand-orange flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:translate-x-1">
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
            <Link
              to="/services"
              className="inline-flex items-center bg-gradient-to-br from-white/[0.2] to-white/[0.04] hover:from-white/[0.32] hover:to-white/[0.12] backdrop-blur-md border border-white/30 hover:border-white/60 text-white font-semibold px-6 py-[11px] rounded-full transition"
            >
              Book a Service
            </Link>
          </div>

          {/* Category shortcuts. Hovering one spotlights its cards in the
              collage, and hovering a card lights up its chip. Below sm the
              row scrolls sideways instead of wrapping, so it stays one line
              above the card row. */}
          {categories.length > 0 && (
            <div
              className="fade-up mt-5 mx-auto flex w-fit max-w-full items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ animationDelay: '330ms' }}
            >
              <span className="hidden sm:inline text-xs font-medium text-white/45 mr-0.5">Popular</span>
              {categories.map(({ slug, name }) => {
                const Icon = getCategoryIcon(slug);
                return (
                  <Link
                    key={slug}
                    to={`/products?category=${slug}`}
                    data-active={spot?.slug === slug}
                    onMouseEnter={() => setSpot({ slug, from: 'chip' })}
                    onMouseLeave={() => setSpot(null)}
                    onFocus={() => setSpot({ slug, from: 'chip' })}
                    onBlur={() => setSpot(null)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-white/75 backdrop-blur-md transition hover:border-white/50 hover:bg-white/[0.16] hover:text-white data-[active=true]:border-brand-orange/70 data-[active=true]:bg-brand-orange/20 data-[active=true]:text-white"
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    {name}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="hero-products">
          {heroProducts.map((p, i) => (
            <HeroProductCard
              key={p.id}
              product={p}
              index={i}
              tilt={tilt}
              lit={spotlight !== null && categorySlugOf(p) === spotlight}
              onHoverChange={(slug) => setSpot(slug ? { slug, from: 'card' } : null)}
            />
          ))}
        </div>

        <div className="villa-ground" aria-hidden="true" />
        <div className="villa-stage" aria-hidden="true">
          <img src="/House.svg" alt="" className="stage-house" fetchpriority="high" />
        </div>
        <div className="villa-clouds" aria-hidden="true">
          <img src="/Cloud2.svg" alt="" className="clouds-img" />
        </div>
      </section>
    </div>
  );
}
