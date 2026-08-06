import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Expand, ArrowRight } from 'lucide-react';
import { api } from '../api/client';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import SafeImage from '../components/SafeImage';
import GalleryLightbox from '../components/GalleryLightbox';
import { GallerySkeleton } from '../components/Skeleton';

export default function Gallery() {
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
    <div className="max-w-7xl mx-auto px-4 pt-16 pb-20">
      <div className="mb-10">
        <p className="eyebrow mb-3">Our Work</p>
        <h1 className="section-title mb-2">Project Gallery</h1>
        <p className="text-gray-500 max-w-lg">A look at completed installations and repairs from our verified technicians.</p>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8">
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
          {Array.from({ length: 6 }).map((_, i) => <GallerySkeleton key={i} />)}
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

      {!items.loading && !items.error && items.data.length > 0 && (
        <Reveal className="mt-16 rounded-2xl bg-brand-navy px-6 py-10 sm:px-12 text-center">
          <p className="font-display text-xl sm:text-2xl font-bold text-white mb-2">Like what you see?</p>
          <p className="text-white/60 mb-6 max-w-md mx-auto">Book a verified technician and get a project like this done in your own home.</p>
          <Link to="/services" className="btn-primary inline-flex items-center gap-2">
            Book a Service <ArrowRight className="w-4 h-4" />
          </Link>
        </Reveal>
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
  );
}
