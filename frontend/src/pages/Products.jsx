import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid } from 'lucide-react';
import { api } from '../api/client';
import ProductCard from '../components/ProductCard';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import Select from '../components/Select';
import { getCategoryIcon } from '../constants/categoryIcons';
import { ProductCardSkeleton, CategorySkeleton } from '../components/Skeleton';

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name', label: 'Name: A to Z' },
];

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState({ data: [], loading: true, error: false });
  const [categories, setCategories] = useState({ data: [], loading: true });
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'featured';

  useEffect(() => {
    api.get('/products/categories')
      .then(data => setCategories({ data, loading: false }))
      .catch(() => setCategories({ data: [], loading: false }));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadProducts = useCallback(() => {
    setProducts(s => ({ ...s, loading: true, error: false }));
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (sort !== 'featured') params.set('sort', sort);
    api.get(`/products?${params}`)
      .then(data => setProducts({ data, loading: false, error: false }))
      .catch(() => setProducts({ data: [], loading: false, error: true }));
  }, [category, debouncedSearch, sort]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleSearch = (e) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    if (search) p.set('search', search); else p.delete('search');
    setSearchParams(p);
    setDebouncedSearch(search);
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-10">
        <p className="eyebrow mb-3">Catalog</p>
        <h1 className="section-title mb-2">Products</h1>
        <p className="text-gray-500 max-w-lg">Browse our wide selection of home improvement products, from air conditioning to smart home devices.</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        {/* Category filter row — same card treatment as the homepage's "Shop by
            category" section, repurposed as toggleable filters (buttons, not
            links) with an "All Products" card standing in for the old sidebar's
            reset option. */}
        <div className="flex gap-2 sm:gap-4 mb-8">
          <button
            onClick={() => { const p = new URLSearchParams(searchParams); p.delete('category'); setSearchParams(p); }}
            className={`card group h-full flex-1 min-w-0 flex flex-col items-center text-center p-3 sm:p-5 gap-2 sm:gap-3 transition ${!category ? 'border-brand-orange/50 ring-1 ring-brand-orange/20' : 'hover:border-brand-orange/40'}`}
          >
            <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${!category ? 'bg-brand-orange/10' : 'bg-brand-navy/5 group-hover:bg-brand-orange/10 group-hover:scale-105'}`}>
              <LayoutGrid className={`w-5 h-5 sm:w-7 sm:h-7 transition-colors ${!category ? 'text-brand-orange' : 'text-brand-navy group-hover:text-brand-orange'}`} />
            </div>
            <h3 className={`font-medium text-xs sm:text-sm leading-tight ${!category ? 'text-brand-navy font-semibold' : 'text-gray-800'}`}>All</h3>
          </button>
          {categories.loading ? (
            Array.from({ length: 9 }).map((_, i) => <div key={i} className="flex-1 min-w-0"><CategorySkeleton /></div>)
          ) : (
            categories.data.map(c => {
              const Icon = getCategoryIcon(c.slug);
              const active = category === c.slug;
              return (
                <button
                  key={c.id}
                  onClick={() => { const p = new URLSearchParams(searchParams); p.set('category', c.slug); setSearchParams(p); }}
                  className={`card group h-full flex-1 min-w-0 flex flex-col items-center text-center p-3 sm:p-5 gap-2 sm:gap-3 transition ${active ? 'border-brand-orange/50 ring-1 ring-brand-orange/20' : 'hover:border-brand-orange/40'}`}
                >
                  <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${active ? 'bg-brand-orange/10' : 'bg-brand-navy/5 group-hover:bg-brand-orange/10 group-hover:scale-105'}`}>
                    <Icon className={`w-5 h-5 sm:w-7 sm:h-7 transition-colors ${active ? 'text-brand-orange' : 'text-brand-navy group-hover:text-brand-orange'}`} />
                  </div>
                  <h3 className={`font-medium text-xs sm:text-sm leading-tight ${active ? 'text-brand-navy font-semibold' : 'text-gray-800'}`}>{c.name}</h3>
                </button>
              );
            })
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10" />
          </form>
          <Select
            value={sort}
            onChange={v => { const p = new URLSearchParams(searchParams); if (v === 'featured') p.delete('sort'); else p.set('sort', v); setSearchParams(p); }}
            options={SORT_OPTIONS}
            className="sm:w-56 shrink-0"
          />
        </div>
        {!products.loading && !products.error && (
          <p className="text-sm text-gray-400 mb-6">
            {products.data.length} product{products.data.length === 1 ? '' : 's'} found
          </p>
        )}
        {products.loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : products.error ? (
          <ErrorState message="Couldn't load products right now." onRetry={loadProducts} />
        ) : products.data.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No products found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.data.map((p, i) => (
              <Reveal key={p.id} delay={(i % 8) * 60} className="h-full">
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
