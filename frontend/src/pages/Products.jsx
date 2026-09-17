import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid } from 'lucide-react';
import { api } from '../api/client';
import ProductCard from '../components/ProductCard';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import Select from '../components/Select';
import CategoryTile, { countLabel } from '../components/CategoryTile';
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
        {/* Category filter row — CategoryTile cards (the homepage's "Shop by
            category" treatment, hover animation included) as toggleable
            filters, with an "All" card standing in for the old sidebar's reset
            option. Below lg the row scrolls sideways instead of squeezing ten
            cards into one line; its vertical padding keeps the hover lift and
            shadow from being clipped by the scroll container. */}
        <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 lg:overflow-visible pt-2 pb-4 mb-4">
          <div className="shrink-0 w-24 sm:w-28 lg:w-auto lg:flex-1 lg:min-w-0">
            <CategoryTile
              icon={LayoutGrid}
              label="All"
              meta={categories.loading ? null : countLabel(categories.data.reduce((sum, c) => sum + (Number(c.product_count) || 0), 0), 'item')}
              action="View"
              active={!category}
              onClick={() => { const p = new URLSearchParams(searchParams); p.delete('category'); setSearchParams(p); }}
            />
          </div>
          {categories.loading ? (
            Array.from({ length: 9 }).map((_, i) => <div key={i} className="shrink-0 w-24 sm:w-28 lg:w-auto lg:flex-1 lg:min-w-0"><CategorySkeleton /></div>)
          ) : (
            categories.data.map(c => (
              <div key={c.id} className="shrink-0 w-24 sm:w-28 lg:w-auto lg:flex-1 lg:min-w-0">
                <CategoryTile
                  icon={getCategoryIcon(c.slug)}
                  label={c.name}
                  meta={countLabel(c.product_count, 'item')}
                  action="View"
                  active={category === c.slug}
                  onClick={() => { const p = new URLSearchParams(searchParams); p.set('category', c.slug); setSearchParams(p); }}
                />
              </div>
            ))
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
