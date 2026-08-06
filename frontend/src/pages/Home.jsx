import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Truck, Wrench, Zap, Star, Quote, Home as HomeIcon } from 'lucide-react';
import { api } from '../api/client';
import Hero from '../components/Hero';
import ProductCard from '../components/ProductCard';
import ServiceCard from '../components/ServiceCard';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import CountUp from '../components/CountUp';
import StarRating from '../components/account/StarRating';
import { getCategoryIcon } from '../constants/categoryIcons';
import { ProductCardSkeleton, ServiceCardSkeleton, CategorySkeleton, ReviewCardSkeleton } from '../components/Skeleton';

const STATS = [
  { value: '10,000+', label: 'Homeowners Served' },
  { value: '500+', label: 'Products Available' },
  { value: '50+', label: 'Verified Technicians' },
  { value: '4.8/5', label: 'Average Rating' },
];

const FEATURES = [
  { icon: Shield, title: 'Verified Technicians', desc: 'All service providers are verified and trained professionals, background-checked before they ever step into your home.' },
  { icon: Truck, title: 'Reliable Delivery', desc: 'Track your orders from purchase to doorstep delivery, with real-time updates every step of the way.' },
  { icon: Wrench, title: 'Expert Services', desc: 'Book installation, cleaning, and repair services easily, with pros matched to the job you need done.' },
  { icon: Star, title: 'Quality Products', desc: 'Curated home improvement products from trusted brands, vetted for durability and performance.' },
];

export default function Home() {
  const [featured, setFeatured] = useState({ data: [], loading: true, error: false });
  const [services, setServices] = useState({ data: [], loading: true, error: false });
  const [categories, setCategories] = useState({ data: [], loading: true, error: false });
  const [reviews, setReviews] = useState({ data: [], loading: true, error: false });
  const [announcements, setAnnouncements] = useState([]);
  const [activeFeature, setActiveFeature] = useState(0);

  const loadFeatured = useCallback(() => {
    setFeatured(s => ({ ...s, loading: true, error: false }));
    api.get('/products?featured=true&limit=4')
      .then(data => setFeatured({ data, loading: false, error: false }))
      .catch(() => setFeatured({ data: [], loading: false, error: true }));
  }, []);

  const loadServices = useCallback(() => {
    setServices(s => ({ ...s, loading: true, error: false }));
    api.get('/services?limit=4')
      .then(data => setServices({ data: data.slice(0, 4), loading: false, error: false }))
      .catch(() => setServices({ data: [], loading: false, error: true }));
  }, []);

  const loadCategories = useCallback(() => {
    setCategories(s => ({ ...s, loading: true, error: false }));
    api.get('/products/categories')
      .then(data => setCategories({ data, loading: false, error: false }))
      .catch(() => setCategories({ data: [], loading: false, error: true }));
  }, []);

  const loadReviews = useCallback(() => {
    setReviews(s => ({ ...s, loading: true, error: false }));
    api.get('/reviews/featured')
      .then(data => setReviews({ data, loading: false, error: false }))
      .catch(() => setReviews({ data: [], loading: false, error: true }));
  }, []);

  useEffect(() => {
    loadFeatured();
    loadServices();
    loadCategories();
    loadReviews();
    api.get('/announcements').then(setAnnouncements).catch(() => {});
  }, [loadFeatured, loadServices, loadCategories, loadReviews]);

  return (
    <div>
      <Hero />

      {/* Stats bar — white, not navy, so the cloud band at the bottom of the
          hero fades into it rather than cutting hard from cloud-white into a
          flat navy block. */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {STATS.map((s, i) => (
            <div key={s.label} className="text-center md:text-left bg-gradient-to-br from-brand-navy to-brand-blue backdrop-blur-md border border-white/10 rounded-2xl px-4 py-5 md:py-6">
              <CountUp value={s.value} delay={i * 100} className="font-display text-2xl md:text-3xl font-extrabold text-white tabular-nums" />
              <p className="text-xs md:text-sm text-white/60 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Announcements — auto-looping marquee (reuses the same track/keyframes
          as the "Built To Last" showcase band below) wrapped in a manually
          scrollable strip, so it drifts on its own but a user can still drag
          it to read ahead or go back. */}
      {announcements.length > 0 && (
        <div className="bg-brand-orange/10 border-b border-brand-orange/20 overflow-x-auto no-scrollbar">
          <div className="py-3">
            <div className="marquee-track items-center">
              {[0, 1].map(dup => (
                <div key={dup} className="flex items-center gap-8 shrink-0 pl-4 pr-12" aria-hidden={dup === 1}>
                  <Zap className="w-5 h-5 text-brand-orange shrink-0" />
                  {announcements.map(a => (
                    <span key={a.id} className="text-sm whitespace-nowrap"><strong>{a.title}:</strong> {a.content}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Features */}
      <section className="py-20 md:py-24 bg-gradient-to-br from-brand-navy to-brand-blue">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center max-w-xl mx-auto mb-10">
            <p className="eyebrow justify-center mb-3">Why HomeLink</p>
            <h2 className="section-title text-white">The HomeLink promise</h2>
          </Reveal>
          <Reveal className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:h-[240px]">
              {FEATURES.map((f, i) => {
                const isOpen = activeFeature === i;
                return (
                  <button
                    key={f.title}
                    type="button"
                    onClick={() => setActiveFeature(i)}
                    onMouseEnter={() => setActiveFeature(i)}
                    onFocus={() => setActiveFeature(i)}
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

      {/* Categories */}
      <section className="py-20 md:py-24 bg-brand-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center max-w-xl mx-auto mb-12">
            <p className="eyebrow justify-center mb-3">What We Offer</p>
            <h2 className="section-title">Shop by category</h2>
          </Reveal>
          <div className="flex gap-2 sm:gap-4">
            {categories.loading ? (
              Array.from({ length: 9 }).map((_, i) => <div key={i} className="flex-1 min-w-0"><CategorySkeleton /></div>)
            ) : categories.error ? (
              <ErrorState message="Couldn't load categories right now." onRetry={loadCategories} />
            ) : (
              categories.data.slice(0, 10).map((c, i) => {
                const Icon = getCategoryIcon(c.slug);
                return (
                  <Reveal key={c.id} delay={i * 50} className="flex-1 min-w-0">
                    <Link to={`/products?category=${c.slug}`} className="card hover:border-brand-orange/40 group h-full flex flex-col items-center text-center p-3 sm:p-5 gap-2 sm:gap-3">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-brand-navy/5 flex items-center justify-center transition-all duration-300 group-hover:bg-brand-orange/10 group-hover:scale-105">
                        <Icon className="w-5 h-5 sm:w-7 sm:h-7 text-brand-navy transition-colors group-hover:text-brand-orange" />
                      </div>
                      <h3 className="font-medium text-xs sm:text-sm text-gray-800 leading-tight">{c.name}</h3>
                    </Link>
                  </Reveal>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-20 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal className="flex justify-between items-end mb-10 gap-4">
            <div>
              <p className="eyebrow mb-3">Handpicked</p>
              <h2 className="section-title">Featured products</h2>
            </div>
            <Link to="/products" className="shrink-0 text-brand-navy font-semibold hover:text-brand-orange transition flex items-center gap-1.5 group">
              View All <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.loading ? (
              Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            ) : featured.error ? (
              <ErrorState message="Couldn't load featured products right now." onRetry={loadFeatured} />
            ) : featured.data.length === 0 ? (
              <p className="col-span-full text-center text-gray-500 py-8">No featured products yet — check back soon.</p>
            ) : (
              featured.data.map((p, i) => (
                <Reveal key={p.id} delay={i * 70} className="h-full">
                  <ProductCard product={p} />
                </Reveal>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Signature showcase band */}
      <section className="relative overflow-hidden bg-brand-navy py-24 md:py-32">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/Homepage.mp4"
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="absolute inset-0 bg-brand-navy/75" />
        <Reveal className="relative z-10 flex flex-col items-center text-center px-4">
          <div className="showcase-float w-56 h-56 md:w-72 md:h-72 rounded-[2rem] bg-gradient-to-br from-white to-gray-100 shadow-2xl flex items-center justify-center">
            <div className="relative">
              <HomeIcon className="w-20 h-20 md:w-24 md:h-24 text-brand-navy" strokeWidth={1.5} />
              <div className="absolute -bottom-2 -right-3 w-12 h-12 rounded-2xl bg-brand-orange flex items-center justify-center shadow-lg">
                <Wrench className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <p className="mt-8 text-gray-300 text-sm max-w-sm">
            Every product installed, every job completed, by technicians who stand behind their work.
          </p>
        </Reveal>
      </section>

      {/* Services */}
      <section className="py-20 md:py-24 bg-brand-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal className="flex justify-between items-end mb-10 gap-4">
            <div>
              <p className="eyebrow mb-3">Book a Pro</p>
              <h2 className="section-title">Popular services</h2>
            </div>
            <Link to="/services" className="shrink-0 text-brand-navy font-semibold hover:text-brand-orange transition flex items-center gap-1.5 group">
              View All <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.loading ? (
              Array.from({ length: 4 }).map((_, i) => <ServiceCardSkeleton key={i} />)
            ) : services.error ? (
              <ErrorState message="Couldn't load services right now." onRetry={loadServices} />
            ) : services.data.length === 0 ? (
              <p className="col-span-full text-center text-gray-500 py-8">No services listed yet — check back soon.</p>
            ) : (
              services.data.map((s, i) => (
                <Reveal key={s.id} delay={i * 70} className="h-full">
                  <ServiceCard service={s} />
                </Reveal>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Reviews */}
      {(reviews.loading || reviews.error || reviews.data.length > 0) && (
        <section className="py-20 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <Reveal className="text-center max-w-xl mx-auto mb-12">
              <p className="eyebrow justify-center mb-3">Testimonials</p>
              <h2 className="section-title">What our customers say</h2>
            </Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.loading ? (
                Array.from({ length: 3 }).map((_, i) => <ReviewCardSkeleton key={i} />)
              ) : reviews.error ? (
                <ErrorState message="Couldn't load reviews right now." onRetry={loadReviews} />
              ) : (
                reviews.data.map((r, i) => (
                  <Reveal key={r.id} delay={i * 70} className="h-full">
                    <div className="card h-full p-6 flex flex-col gap-3">
                      <Quote className="w-6 h-6 text-brand-orange/40" />
                      <StarRating value={r.rating} readOnly size="w-4 h-4" />
                      <p className="text-gray-600 text-sm leading-relaxed flex-1">{r.comment}</p>
                      <div className="flex items-center gap-3 pt-4 mt-1 border-t border-gray-100">
                        <div className="w-9 h-9 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy font-semibold text-sm shrink-0">
                          {r.first_name[0]}{r.last_name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{r.first_name} {r.last_name}</p>
                          <p className="text-xs text-gray-400 truncate">{r.product_name}</p>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="relative overflow-hidden py-20 md:py-24 bg-brand-navy text-white">
        <div className="absolute inset-0 opacity-[0.18] pointer-events-none" aria-hidden="true">
          <div className="float-blob absolute -top-16 left-1/3 w-80 h-80 bg-brand-orange rounded-full blur-3xl" />
          <div className="float-blob-delayed absolute -bottom-24 right-1/4 w-80 h-80 bg-brand-teal rounded-full blur-3xl" />
        </div>
        <Reveal className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight mb-5">Ready to upgrade your home?</h2>
          <p className="text-gray-300 mb-10 max-w-lg mx-auto">Join thousands of homeowners who trust HomeLink for their home improvement needs.</p>
          <Link to="/register" className="btn-primary inline-flex items-center gap-2">Get Started Free <ArrowRight className="w-4 h-4" /></Link>
        </Reveal>
      </section>
    </div>
  );
}
