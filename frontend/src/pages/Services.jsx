import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ShieldCheck, Tag, Award, LayoutGrid } from 'lucide-react';
import { api } from '../api/client';
import ServiceCard from '../components/ServiceCard';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import CategoryTile, { countLabel } from '../components/CategoryTile';
import { getServiceCategoryIcon } from '../constants/serviceCategoryIcons';
import { ServiceCardSkeleton, CategorySkeleton } from '../components/Skeleton';

const TRUST_POINTS = [
  { icon: ShieldCheck, label: 'Verified Technicians' },
  { icon: Tag, label: 'Upfront Pricing' },
  { icon: Award, label: 'Satisfaction Guaranteed' },
];

export default function Services() {
  const [services, setServices] = useState({ data: [], loading: true, error: false });
  const [categories, setCategories] = useState({ data: [], loading: true });
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const category = searchParams.get('category') || '';

  useEffect(() => {
    // [{ category, count }]; an API build without ?withCounts support returns
    // plain names instead, in which case the cards just omit their count line.
    api.get('/services/categories?withCounts=1')
      .then(data => setCategories({ data: data.map(c => (typeof c === 'string' ? { category: c, count: null } : c)), loading: false }))
      .catch(() => setCategories({ data: [], loading: false }));
  }, []);

  const hasCounts = categories.data.length > 0 && categories.data.every(c => c.count != null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadServices = useCallback(() => {
    setServices(s => ({ ...s, loading: true, error: false }));
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (debouncedSearch) params.set('search', debouncedSearch);
    api.get(`/services?${params}`)
      .then(data => setServices({ data, loading: false, error: false }))
      .catch(() => setServices({ data: [], loading: false, error: true }));
  }, [category, debouncedSearch]);

  useEffect(() => { loadServices(); }, [loadServices]);

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-10">
        <p className="eyebrow mb-3">Book a Pro</p>
        <h1 className="section-title mb-2">Professional Services</h1>
        <p className="text-gray-500 max-w-lg mb-5">Book verified technicians for installation, maintenance, and repair.</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {TRUST_POINTS.map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
              <Icon className="w-4 h-4 text-brand-teal" /> {label}
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        {/* Category filter row — CategoryTile cards, same treatment and hover
            animation as the Products page and the homepage's "Shop by
            category", with an "All" card replacing the old text tabs. Scrolls
            sideways below lg (see the matching note in Products.jsx). */}
        <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 lg:overflow-visible pt-2 pb-4 mb-4">
          <div className="shrink-0 w-24 sm:w-28 lg:w-auto lg:flex-1 lg:min-w-0">
            <CategoryTile
              icon={LayoutGrid}
              label="All"
              meta={hasCounts ? countLabel(categories.data.reduce((sum, c) => sum + c.count, 0), 'service') : null}
              action="View"
              active={!category}
              onClick={() => setSearchParams({})}
            />
          </div>
          {categories.loading ? (
            Array.from({ length: 6 }).map((_, i) => <div key={i} className="shrink-0 w-24 sm:w-28 lg:w-auto lg:flex-1 lg:min-w-0"><CategorySkeleton /></div>)
          ) : (
            categories.data.map(c => (
              <div key={c.category} className="shrink-0 w-24 sm:w-28 lg:w-auto lg:flex-1 lg:min-w-0">
                <CategoryTile
                  icon={getServiceCategoryIcon(c.category)}
                  label={c.category}
                  meta={hasCounts ? countLabel(c.count, 'service') : null}
                  action="View"
                  active={category === c.category}
                  onClick={() => setSearchParams({ category: c.category })}
                />
              </div>
            ))
          )}
        </div>

        <form onSubmit={e => e.preventDefault()} className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10" />
        </form>
        {!services.loading && !services.error && (
          <p className="text-sm text-gray-400 mb-6">
            {services.data.length} service{services.data.length === 1 ? '' : 's'} found
          </p>
        )}

        {services.loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <ServiceCardSkeleton key={i} />)}
          </div>
        ) : services.error ? (
          <ErrorState message="Couldn't load services right now." onRetry={loadServices} />
        ) : services.data.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No services found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.data.map((s, i) => (
              <Reveal key={s.id} delay={(i % 6) * 60} className="h-full">
                <ServiceCard service={s} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
