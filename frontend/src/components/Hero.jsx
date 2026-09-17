import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, User, ShoppingCart, Star } from 'lucide-react';
import { formatPrice } from '../api/client';
import SafeImage from './SafeImage';

// Cards fade out by this --progress value (see .hero-product opacity in
// index.css); past it they're hidden outright so the invisible links behind
// the house can't be clicked or tabbed to.
const CARDS_HIDDEN_AT = 0.8;

function HeroRating({ product }) {
  if (!(product.review_count > 0)) return null;
  return (
    <span className="flex items-center gap-1 text-[11px] text-gray-400">
      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
      <span className="font-semibold text-gray-600">{Number(product.avg_rating).toFixed(1)}</span>
      ({product.review_count})
    </span>
  );
}

function CartBadge() {
  return (
    <span className="w-8 h-8 rounded-full bg-brand-orange text-white flex items-center justify-center shrink-0 shadow-sm" aria-hidden="true">
      <ShoppingCart className="w-4 h-4" />
    </span>
  );
}

// Product cards flanking the hero copy. Odd slots are tall cards, even slots
// compact rows; slots 1-4 are the front layer and 5-8 a smaller back layer
// tucked behind them. Position and scroll travel live in index.css
// (.hero-product--N), so each breakpoint can show and rearrange a subset.
function HeroProductCard({ product, index }) {
  const compact = index % 2 === 1;
  return (
    <Link
      to={`/products/${product.slug}`}
      className={`hero-product hero-product--${index + 1}`}
      aria-label={`${product.name}, ${formatPrice(product.price)}`}
    >
      <div className="fade-up" style={{ animationDelay: `${360 + index * 120}ms` }}>
        <div className="hero-product-float" style={{ animationDelay: `${index * -1.6}s` }}>
          {compact ? (
            <div className="hero-product-card hero-product-card--compact flex items-center gap-3">
              <SafeImage src={product.image} alt="" className="w-14 h-14 rounded-xl object-cover bg-gray-100 shrink-0" iconClassName="w-5 h-5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand-ink truncate">{product.name}</p>
                <HeroRating product={product} />
                <p className="text-sm font-bold text-brand-navy">{formatPrice(product.price)}</p>
              </div>
              <CartBadge />
            </div>
          ) : (
            <div className="hero-product-card hero-product-card--tall">
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
                <p className="text-sm font-semibold text-brand-ink truncate mt-0.5">{product.name}</p>
                <HeroRating product={product} />
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="font-bold text-brand-navy">{formatPrice(product.price)}</span>
                  <CartBadge />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Hero({ products = [] }) {
  const wrapRef = useRef(null);
  const pinRef = useRef(null);
  // The background footage is near-invisible by design (see .hero-video), so
  // it's skipped where it costs the most for the least: small screens, where
  // it would pull a ~40MB loop over mobile data, and reduced-motion users.
  const [showVideo] = useState(() =>
    window.matchMedia('(min-width: 900px) and (prefers-reduced-motion: no-preference)').matches
  );

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
      <section className="hero-pin" ref={pinRef}>
        {showVideo && (
          <video className="hero-video" src="/Homepage.mp4" autoPlay muted loop playsInline aria-hidden="true" />
        )}
        <div className="hero-copy">
          <div className="fade-up inline-flex items-center gap-2.5 bg-gradient-to-br from-white/[0.24] to-white/[0.06] backdrop-blur-md border border-white/25 rounded-full pl-2 pr-4 py-1.5 text-sm font-semibold text-white/90 mb-4" style={{ animationDelay: '0ms' }}>
            <span className="flex -space-x-2 shrink-0">
              <span className="w-6 h-6 rounded-full ring-2 ring-white bg-gradient-to-br from-sky-400 to-brand-navy flex items-center justify-center"><User className="w-3 h-3 text-white" /></span>
              <span className="w-6 h-6 rounded-full ring-2 ring-white bg-gradient-to-br from-amber-300 to-brand-orange flex items-center justify-center"><User className="w-3 h-3 text-white" /></span>
              <span className="w-6 h-6 rounded-full ring-2 ring-white bg-gradient-to-br from-emerald-300 to-brand-teal flex items-center justify-center"><User className="w-3 h-3 text-white" /></span>
            </span>
            10,000+ Homeowners Served
          </div>

          <h1
            className="fade-up font-display font-extrabold tracking-tightest leading-[0.98] text-white mb-4 text-[clamp(2rem,5vw,3.75rem)]"
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
              className="inline-flex items-center gap-3 bg-brand-orange hover:bg-orange-600 text-white font-semibold pl-6 pr-2 py-2 rounded-full transition shadow-sm hover:shadow-md"
            >
              Browse Products
              <span className="w-9 h-9 rounded-full bg-white text-brand-orange flex items-center justify-center shrink-0">
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
        </div>

        <div className="hero-products">
          {products.slice(0, 8).map((p, i) => (
            <HeroProductCard key={p.id} product={p} index={i} />
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
