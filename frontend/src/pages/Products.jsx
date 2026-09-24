import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid } from 'lucide-react';
import { api } from '../api/client';
import ProductCard from '../components/ProductCard';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import Select from '../components/Select';
import Pagination from '../components/Pagination';
import CategoryTile, { countLabel } from '../components/CategoryTile';
import { getCategoryIcon } from '../constants/categoryIcons';
import { ProductCardSkeleton, CategorySkeleton } from '../components/Skeleton';

const PAGE_SIZE = 30;

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name', label: 'Name: A to Z' },
];

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState({ data: [], total: 0, loading: true, error: false });
  const [categories, setCategories] = useState({ data: [], loading: true });
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'featured';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const totalPages = Math.max(1, Math.ceil(products.total / PAGE_SIZE));

  // Page 1 is the bare URL rather than ?page=1, so a link to the top of the catalog looks
  // the same whether the visitor ever paged or not.
  const setPage = useCallback((next, { replace = false } = {}) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (next <= 1) p.delete('page'); else p.set('page', String(next));
      return p;
    }, { replace });
  }, [setSearchParams]);

  // Any filter change starts the result set over: page 3 of the whole catalog is an offset
  // the next filter may not even reach, which would land the visitor on an empty grid.
  const updateFilter = (mutate) => {
    const p = new URLSearchParams(searchParams);
    mutate(p);
    p.delete('page');
    setSearchParams(p);
  };

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
    // meta=1 asks for the matching row count alongside the rows — one page's worth of
    // products can't tell the pager how many pages there are.
    params.set('meta', '1');
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String((page - 1) * PAGE_SIZE));
    api.get(`/products?${params}`)
      .then(data => setProducts({ data: data.products, total: data.total, loading: false, error: false }))
      .catch(() => setProducts({ data: [], total: 0, loading: false, error: true }));
  }, [category, debouncedSearch, sort, page]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // A bookmarked or hand-edited ?page= can point past the end of the catalog; fall back to
  // the last real page rather than an empty grid. Replaced, not pushed, so Back still leaves.
  useEffect(() => {
    if (products.loading || products.error) return;
    if (page > totalPages) setPage(totalPages, { replace: true });
  }, [products.loading, products.error, page, totalPages, setPage]);

  const handleSearch = (e) => {
    e.preventDefault();
    updateFilter(p => { if (search) p.set('search', search); else p.delete('search'); });
    setDebouncedSearch(search);
  };

  // Typing refetches on a debounce without going through the URL, so the page has to be
  // cleared on the keystroke rather than when the debounce lands — otherwise the new term
  // would first be searched at the old page's offset.
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    if (searchParams.has('page')) setPage(1, { replace: true });
  };

  const handlePageChange = (next) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
              onClick={() => updateFilter(p => p.delete('category'))}
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
                  onClick={() => updateFilter(p => p.set('category', c.slug))}
                />
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Search products..." value={search} onChange={handleSearchChange} className="input-field pl-10" />
          </form>
          <Select
            value={sort}
            onChange={v => updateFilter(p => { if (v === 'featured') p.delete('sort'); else p.set('sort', v); })}
            options={SORT_OPTIONS}
            className="sm:w-56 shrink-0"
          />
        </div>
        {!products.loading && !products.error && (
          <p className="text-sm text-gray-400 mb-6">
            {products.total} product{products.total === 1 ? '' : 's'} found
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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.data.map((p, i) => (
                <Reveal key={p.id} delay={(i % 8) * 60} className="h-full">
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
            <div className="mt-10">
              <Pagination
                page={page}
                totalPages={totalPages}
                total={products.total}
                pageSize={PAGE_SIZE}
                onChange={handlePageChange}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
