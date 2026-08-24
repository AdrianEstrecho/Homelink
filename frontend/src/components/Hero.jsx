import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, User } from 'lucide-react';

export default function Hero() {
  const wrapRef = useRef(null);
  const pinRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const pin = pinRef.current;
    if (!wrap || !pin) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let ticking = false;
    // Decelerating curve so the house's growth settles into place near the end
    // of the scroll range instead of scaling at a constant, mechanical rate.
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const update = () => {
      ticking = false;
      const rect = wrap.getBoundingClientRect();
      const scrollable = wrap.offsetHeight - pin.offsetHeight;
      const raw = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;
      pin.style.setProperty('--progress', easeOutCubic(raw).toFixed(4));
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
