import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, HeartHandshake, Target, Sparkles, Home as HomeIcon, Wrench, Expand } from 'lucide-react';
import { api } from '../api/client';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import CountUp from '../components/CountUp';
import SafeImage from '../components/SafeImage';
import GalleryLightbox from '../components/GalleryLightbox';
import { GallerySkeleton } from '../components/Skeleton';

const STATS = [
  { value: '10,000+', label: 'Homeowners Served' },
  { value: '500+', label: 'Products Available' },
  { value: '50+', label: 'Verified Technicians' },
  { value: '4.8/5', label: 'Average Rating' },
];

const VALUES = [
  { icon: ShieldCheck, title: 'Trust, verified', desc: 'Every technician on HomeLink is background-checked and trained before they ever step into your home.' },
  { icon: Sparkles, title: 'Quality first', desc: 'We curate products from brands we trust, and hold every installation to the same high standard.' },
  { icon: HeartHandshake, title: 'Customer-obsessed', desc: 'From browsing to booking to follow-up, we design every step around what makes your life easier.' },
  { icon: Target, title: 'One platform', desc: 'Products and professional installation in one place, so you never have to coordinate between vendors.' },
];

export default function About() {
  const [items, setItems] = useState({ data: [], loading: true, error: false });
  const [category, setCategory] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const loadItems = useCallback(() => {
    setItems(s => ({ ...s, loading: true, error: false }));
    api.get('/gallery')
      .then(data => setItems({ data, loading: false, error: false }))
      .catch(() => setItems({ data: [], loading: false, error: true }));
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const categories = useMemo(() => [...new Set(items.data.map(g => g.category).filter(Boolean))], [items.data]);
  const filtered = useMemo(() => category ? items.data.filter(g => g.category === category) : items.data, [items.data, category]);

  return (
    <div>
      {/* Header */}
      <section className="pt-16 pb-14 md:pt-20 md:pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="eyebrow justify-center mb-4"><HomeIcon className="w-3.5 h-3.5" /> About HomeLink</p>
          <h1 className="section-title mb-4">Home improvement, done right</h1>
          <p className="text-gray-500 leading-relaxed">
            HomeLink brings home improvement products and the professionals who install them into one place,
            so homeowners can shop, book, and get the job done without juggling multiple vendors.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="bg-brand-light py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-3">
              <p className="eyebrow mb-3">Our Story</p>
              <h2 className="section-title mb-5">Why we started HomeLink</h2>
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
            </div>
            <div className="lg:col-span-2 flex justify-center">
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-[2rem] bg-gradient-to-br from-brand-navy to-brand-blue shadow-xl flex items-center justify-center">
                <HomeIcon className="w-20 h-20 sm:w-24 sm:h-24 text-white" strokeWidth={1.5} />
                <div className="absolute -bottom-3 -right-3 w-14 h-14 rounded-2xl bg-brand-orange flex items-center justify-center shadow-lg">
                  <Wrench className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 80} className="text-center bg-gradient-to-br from-brand-navy to-brand-blue rounded-2xl px-4 py-6">
              <CountUp value={s.value} delay={i * 100} className="font-display text-2xl md:text-3xl font-extrabold text-white tabular-nums" />
              <p className="text-xs md:text-sm text-white/60 mt-1">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-20 bg-brand-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center max-w-xl mx-auto mb-12">
            <p className="eyebrow justify-center mb-3">What We Stand For</p>
            <h2 className="section-title">The values behind HomeLink</h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 80} className="h-full">
                <div className="card h-full p-6">
                  <div className="w-11 h-11 rounded-xl bg-brand-navy/5 flex items-center justify-center mb-4">
                    <v.icon className="w-5 h-5 text-brand-orange" />
                  </div>
                  <h3 className="font-display font-bold text-brand-ink mb-2">{v.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center max-w-xl mx-auto mb-10">
            <p className="eyebrow justify-center mb-3">Our Work</p>
            <h2 className="section-title mb-2">Project Gallery</h2>
            <p className="text-gray-500">A look at completed installations and repairs from our verified technicians.</p>
          </Reveal>

          {categories.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-8">
              <button onClick={() => setCategory('')} className={`text-sm font-medium transition pb-0.5 border-b-2 ${!category ? 'border-brand-orange text-brand-navy font-semibold' : 'border-transparent text-gray-500 hover:text-brand-navy'}`}>
                All
              </button>
              {categories.map(c => (
                <button key={c} onClick={() => setCategory(c)} className={`text-sm font-medium transition pb-0.5 border-b-2 ${category === c ? 'border-brand-orange text-brand-navy font-semibold' : 'border-transparent text-gray-500 hover:text-brand-navy'}`}>
                  {c}
                </button>
              ))}
            </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((g, i) => (
                <Reveal key={g.id} delay={(i % 6) * 60}>
                  <button
                    onClick={() => setLightboxIndex(i)}
                    className="card group relative overflow-hidden w-full text-left"
                  >
                    <div className="relative h-64 overflow-hidden bg-gray-100">
                      <SafeImage src={g.image} alt={g.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/85 via-brand-navy/10 to-transparent opacity-90 group-hover:opacity-100 transition" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <span className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                          <Expand className="w-4.5 h-4.5 text-white" />
                        </span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        {g.category && <span className="badge bg-brand-teal text-white mb-1.5">{g.category}</span>}
                        <h3 className="font-display font-bold text-white leading-snug">{g.title}</h3>
                      </div>
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
          <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight mb-5">Let's get your home sorted</h2>
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
