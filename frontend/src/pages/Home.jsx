import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Shield, Truck, Wrench, Zap, Star, Quote,
  AirVent, Sun, Camera, Droplets, Smartphone, Refrigerator, Lightbulb, Hammer, Package,
} from 'lucide-react';
import { api } from '../api/client';
import ProductCard from '../components/ProductCard';
import ServiceCard from '../components/ServiceCard';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import StarRating from '../components/account/StarRating';
import { ProductCardSkeleton, ServiceCardSkeleton, CategorySkeleton, ReviewCardSkeleton } from '../components/Skeleton';

const CATEGORY_ICONS = {
  'air-conditioners': AirVent,
  'solar-panels': Sun,
  'cctv-security': Camera,
  electrical: Zap,
  plumbing: Droplets,
  'smart-home': Smartphone,
  'home-appliances': Refrigerator,
  lighting: Lightbulb,
  tools: Hammer,
};

export default function Home() {
  const [featured, setFeatured] = useState({ data: [], loading: true, error: false });
  const [services, setServices] = useState({ data: [], loading: true, error: false });
  const [categories, setCategories] = useState({ data: [], loading: true, error: false });
  const [reviews, setReviews] = useState({ data: [], loading: true, error: false });
  const [announcements, setAnnouncements] = useState([]);

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
      {/* Hero */}
      <section className="relative bg-brand-navy text-white overflow-hidden">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/Homepage.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-navy/90 via-brand-blue/80 to-brand-navy/90" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <div className="max-w-2xl">
            <span className="fade-up inline-block bg-brand-orange/20 text-brand-orange border border-brand-orange/30 px-4 py-1 rounded-full text-sm font-medium mb-6" style={{ animationDelay: '0ms' }}>
              Your Home Improvement Partner
            </span>
            <h1 className="fade-up font-display text-4xl md:text-6xl font-bold leading-tight mb-6" style={{ animationDelay: '90ms' }}>
              Shop Products.<br />Book Services.<br /><span className="text-brand-orange">All in One Place.</span>
            </h1>
            <p className="fade-up text-lg text-gray-300 mb-8 leading-relaxed" style={{ animationDelay: '180ms' }}>
              HomeLink connects you with quality home improvement products and verified professional technicians for installation, maintenance, and repair.
            </p>
            <div className="fade-up flex flex-wrap gap-4" style={{ animationDelay: '270ms' }}>
              <Link to="/products" className="btn-primary flex items-center gap-2">Browse Products <ArrowRight className="w-4 h-4" /></Link>
              <Link to="/services" className="btn-outline border-white text-white hover:bg-white hover:text-brand-navy flex items-center gap-2">Book a Service</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="bg-brand-orange/10 border-b border-brand-orange/20">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 overflow-x-auto">
            <Zap className="w-5 h-5 text-brand-orange shrink-0" />
            {announcements.map(a => (
              <span key={a.id} className="text-sm whitespace-nowrap"><strong>{a.title}:</strong> {a.content}</span>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: 'Verified Technicians', desc: 'All service providers are verified and trained professionals.' },
              { icon: Truck, title: 'Reliable Delivery', desc: 'Track your orders from purchase to doorstep delivery.' },
              { icon: Wrench, title: 'Expert Services', desc: 'Book installation, cleaning, and repair services easily.' },
              { icon: Star, title: 'Quality Products', desc: 'Curated home improvement products from trusted brands.' },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 80} className="text-center p-6 rounded-xl hover:bg-brand-light transition-colors group">
                <div className="w-14 h-14 bg-brand-navy/10 rounded-xl flex items-center justify-center mx-auto mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:bg-brand-orange/10">
                  <f.icon className="w-7 h-7 text-brand-navy transition-colors group-hover:text-brand-orange" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm">{f.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-brand-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal as="h2" className="font-display text-3xl font-bold text-brand-navy mb-8 text-center">Shop by Category</Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.loading ? (
              Array.from({ length: 5 }).map((_, i) => <CategorySkeleton key={i} />)
            ) : categories.error ? (
              <ErrorState message="Couldn't load categories right now." onRetry={loadCategories} />
            ) : (
              categories.data.slice(0, 10).map((c, i) => {
                const Icon = CATEGORY_ICONS[c.slug] || Package;
                return (
                  <Reveal key={c.id} delay={i * 50} className="h-full">
                    <Link to={`/products?category=${c.slug}`} className="card hover:shadow-md group h-full flex flex-col items-center text-center p-6 gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-brand-navy/10 flex items-center justify-center transition-all duration-300 group-hover:bg-brand-orange/15 group-hover:scale-110">
                        <Icon className="w-7 h-7 text-brand-navy transition-colors group-hover:text-brand-orange" />
                      </div>
                      <h3 className="font-medium text-sm text-gray-800">{c.name}</h3>
                    </Link>
                  </Reveal>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal className="flex justify-between items-center mb-8">
            <h2 className="font-display text-3xl font-bold text-brand-navy">Featured Products</h2>
            <Link to="/products" className="text-[#c8461a] font-semibold hover:underline flex items-center gap-1">View All <ArrowRight className="w-4 h-4" /></Link>
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

      {/* Services */}
      <section className="py-16 bg-brand-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal className="flex justify-between items-center mb-8">
            <h2 className="font-display text-3xl font-bold text-brand-navy">Popular Services</h2>
            <Link to="/services" className="text-[#c8461a] font-semibold hover:underline flex items-center gap-1">View All <ArrowRight className="w-4 h-4" /></Link>
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
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <Reveal as="h2" className="font-display text-3xl font-bold text-brand-navy mb-8 text-center">What Our Customers Say</Reveal>
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
                      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
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
      <section className="py-16 bg-brand-navy text-white">
        <Reveal className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold mb-4">Ready to Upgrade Your Home?</h2>
          <p className="text-gray-300 mb-8">Join thousands of homeowners who trust HomeLink for their home improvement needs.</p>
          <Link to="/register" className="btn-primary inline-flex items-center gap-2">Get Started Free <ArrowRight className="w-4 h-4" /></Link>
        </Reveal>
      </section>
    </div>
  );
}
