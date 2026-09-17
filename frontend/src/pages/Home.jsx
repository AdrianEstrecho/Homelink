import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, CreditCard, Lock, RotateCcw, CalendarX, ShieldCheck, Smartphone, QrCode, Landmark, Phone, Mail, Clock, ChevronDown } from 'lucide-react';
import { api } from '../api/client';
import Hero from '../components/Hero';
import ProductCard from '../components/ProductCard';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import CountUp from '../components/CountUp';
import HowItWorks from '../components/home/HowItWorks';
import ServicesShowcase from '../components/home/ServicesShowcase';
import Testimonials from '../components/home/Testimonials';
import SpotlightCard from '../components/home/SpotlightCard';
import CategoryTile, { countLabel } from '../components/CategoryTile';
import { getCategoryIcon } from '../constants/categoryIcons';
import { ProductCardSkeleton, CategorySkeleton } from '../components/Skeleton';

const STATS = [
  { value: '10,000+', label: 'Homeowners Served' },
  { value: '500+', label: 'Products Available' },
  { value: '50+', label: 'Verified Technicians' },
  { value: '4.8/5', label: 'Average Rating' },
];

// Condensed from the Refund / Cancellation / Data Privacy policies (see /policies).
const GUARANTEES = [
  { icon: Lock, title: 'Secure checkout', desc: 'Online payments are processed through PayMongo’s secure checkout, and every order is confirmed by email.' },
  { icon: RotateCcw, title: 'Refund protection', desc: 'Order or service not fulfilled? Request a refund within 7 days. Refunds are processed in 5–10 business days.' },
  { icon: CalendarX, title: 'Flexible cancellations', desc: 'Cancel product orders before they ship, and service bookings up to 24 hours before your appointment.' },
  { icon: ShieldCheck, title: 'Your data, protected', desc: 'Personal and payment details are kept confidential and handled in line with the Data Privacy Act.' },
];

const PAYMENT_METHODS = [
  { icon: CreditCard, label: 'Credit / Debit Card' },
  { icon: Smartphone, label: 'GCash' },
  { icon: QrCode, label: 'QR Ph' },
  { icon: Landmark, label: 'Bank Transfer' },
];

// Fallbacks match the defaults served by GET /promos/location.
const DEFAULT_CONTACT = { phone: '(02) 8123-4567', email: 'support@homelink.com' };

export default function Home() {
  const [featured, setFeatured] = useState({ data: [], loading: true, error: false });
  const [services, setServices] = useState({ data: [], loading: true, error: false });
  const [categories, setCategories] = useState({ data: [], loading: true, error: false });
  const [reviews, setReviews] = useState({ data: [], loading: true, error: false });
  const [announcements, setAnnouncements] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [openFaq, setOpenFaq] = useState(0);
  const [contact, setContact] = useState(DEFAULT_CONTACT);

  // One request feeds both the hero's 8 floating cards and the Featured
  // section: the API's default sort is featured-first, so the featured rows
  // among these 8 are exactly what ?featured=true&limit=4 would return —
  // without downloading the same (base64-image-heavy) rows twice.
  const loadFeatured = useCallback(() => {
    setFeatured(s => ({ ...s, loading: true, error: false }));
    api.get('/products?limit=8')
      .then(data => setFeatured({ data, loading: false, error: false }))
      .catch(() => setFeatured({ data: [], loading: false, error: true }));
  }, []);

  // Most-booked first; only the top 4 are shown, so only 4 rows are fetched.
  const loadServices = useCallback(() => {
    setServices(s => ({ ...s, loading: true, error: false }));
    api.get('/services?sort=popular&limit=4')
      .then(data => setServices({ data, loading: false, error: false }))
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
    api.get('/faqs').then(data => setFaqs(data.slice(0, 5))).catch(() => {});
    api.get('/promos/location')
      .then(data => setContact({ phone: data.phone || DEFAULT_CONTACT.phone, email: data.email || DEFAULT_CONTACT.email }))
      .catch(() => {});
  }, [loadFeatured, loadServices, loadCategories, loadReviews]);

  const featuredProducts = featured.data.filter(p => p.featured).slice(0, 4);

  // Section backgrounds alternate light / white down the page, with navy
  // bands (Shop with confidence, CTA) as the dark breaks:
  // stats white → categories light → featured white → how it works light →
  // services white → confidence navy → testimonials white → FAQ light → CTA navy.
  return (
    <div>
      <Hero products={featured.data} />

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

      {/* Announcements — auto-looping marquee (.marquee-track in index.css)
          wrapped in a manually scrollable strip, so it drifts on its own but
          a user can still drag it to read ahead or go back. */}
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

      {/* Categories — hover animation lives in CategoryTile, shared with the
          Products and Services filter rows. */}
      <section className="py-20 md:py-24 bg-brand-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center max-w-xl mx-auto mb-12">
            <p className="eyebrow justify-center mb-3">What We Offer</p>
            <h2 className="section-title">Shop by category</h2>
          </Reveal>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 sm:gap-4">
            {categories.loading ? (
              Array.from({ length: 9 }).map((_, i) => <CategorySkeleton key={i} />)
            ) : categories.error ? (
              <div className="col-span-full"><ErrorState message="Couldn't load categories right now." onRetry={loadCategories} /></div>
            ) : (
              categories.data.slice(0, 9).map((c, i) => (
                <Reveal key={c.id} delay={i * 50} className="h-full">
                  <CategoryTile
                    as={Link}
                    to={`/products?category=${c.slug}`}
                    icon={getCategoryIcon(c.slug)}
                    label={c.name}
                    meta={countLabel(c.product_count, 'item')}
                    action="Shop"
                  />
                </Reveal>
              ))
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
            ) : featuredProducts.length === 0 ? (
              <p className="col-span-full text-center text-gray-500 py-8">No featured products yet — check back soon.</p>
            ) : (
              featuredProducts.map((p, i) => (
                <Reveal key={p.id} delay={i * 70} className="h-full">
                  <div className="h-full transition-transform duration-300 hover:-translate-y-1.5">
                    <ProductCard product={p} />
                  </div>
                </Reveal>
              ))
            )}
          </div>
        </div>
      </section>

      <HowItWorks />

      <ServicesShowcase services={services} onRetry={loadServices} />

      {/* Shop with confidence — payments and policy guarantees, on a navy
          band. Each guarantee card carries a pointer-following glow. */}
      <section className="py-20 md:py-24 bg-gradient-to-br from-brand-navy to-brand-blue">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14 items-center">
          <Reveal className="lg:col-span-2">
            <p className="eyebrow mb-3">Shop With Confidence</p>
            <h2 className="section-title text-white mb-4">Protected from checkout to completion</h2>
            <p className="text-white/70 leading-relaxed mb-8">
              Clear policies, secure payments, and a support team that answers. Here’s what comes with every HomeLink order and booking.
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50 mb-3">Accepted payments</p>
            <div className="flex flex-wrap gap-2 mb-8">
              {PAYMENT_METHODS.map(m => (
                <span key={m.label} className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/15 rounded-full px-3.5 py-1.5 text-sm font-medium text-white transition-all duration-300 hover:bg-white/[0.12] hover:border-white/30 hover:-translate-y-0.5">
                  <m.icon className="w-4 h-4 text-brand-orange" /> {m.label}
                </span>
              ))}
            </div>
            <Link to="/policies" className="text-white font-semibold hover:text-brand-orange transition inline-flex items-center gap-1.5 group">
              Read our policies <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {GUARANTEES.map((g, i) => (
              <Reveal key={g.title} delay={i * 70} className="h-full">
                <SpotlightCard className="h-full">
                  <div className="p-6">
                    <div className="w-11 h-11 rounded-xl bg-brand-orange/20 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                      <g.icon className="w-5 h-5 text-brand-orange" />
                    </div>
                    <h3 className="font-display font-bold text-white mb-2">{g.title}</h3>
                    <p className="text-white/70 text-sm leading-relaxed">{g.desc}</p>
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Testimonials reviews={reviews} onRetry={loadReviews} />

      {/* FAQ preview + support contacts. The open question gets an orange
          accent bar and a filled chevron; its answer fades in as it expands. */}
      {faqs.length > 0 && (
        <section className="py-20 md:py-24 bg-brand-light">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14 items-start">
            <Reveal className="lg:col-span-2">
              <p className="eyebrow mb-3">Need Help?</p>
              <h2 className="section-title mb-4">Questions, answered</h2>
              <p className="text-gray-500 leading-relaxed mb-8">
                Quick answers to what homeowners ask us most. Can’t find yours? Our support team is a call or an email away.
              </p>
              <div className="card p-6 space-y-3">
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-brand-navy transition group">
                  <span className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 transition group-hover:border-brand-teal/40 group-hover:scale-110"><Phone className="w-4 h-4 text-brand-teal" /></span>
                  {contact.phone}
                </a>
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-brand-navy transition group">
                  <span className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 transition group-hover:border-brand-teal/40 group-hover:scale-110"><Mail className="w-4 h-4 text-brand-teal" /></span>
                  {contact.email}
                </a>
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0"><Clock className="w-4 h-4 text-brand-teal" /></span>
                  Mon – Sat, 8:00 AM – 6:00 PM
                </div>
                <p className="text-xs text-gray-400 pt-4 mt-1 border-t border-gray-100">We respond within 24 hours on business days.</p>
              </div>
            </Reveal>

            <Reveal className="lg:col-span-3">
              <div className="card divide-y divide-gray-100">
                {faqs.map((item, i) => {
                  const isOpen = openFaq === i;
                  return (
                    <div key={item.id} className={`relative transition-colors duration-300 ${isOpen ? 'bg-brand-orange/[0.04]' : 'hover:bg-brand-light/60'}`}>
                      <span
                        className={`absolute left-0 inset-y-0 w-1 bg-brand-orange origin-top transition-transform duration-300 ${isOpen ? 'scale-y-100' : 'scale-y-0'}`}
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : i)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                      >
                        <span className="font-display font-bold text-brand-ink">{item.question}</span>
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${isOpen ? 'bg-brand-orange text-white rotate-180' : 'bg-brand-light text-gray-400'}`}>
                          <ChevronDown className="w-4 h-4" />
                        </span>
                      </button>
                      <div className="grid transition-[grid-template-rows] duration-300 ease-in-out" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
                        <div className="overflow-hidden">
                          <p className={`text-gray-500 text-sm leading-relaxed px-6 pb-5 pr-16 transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}>
                            {item.answer}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link to="/faq" className="mt-6 text-brand-navy font-semibold hover:text-brand-orange transition inline-flex items-center gap-1.5 group">
                View all FAQs <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
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
