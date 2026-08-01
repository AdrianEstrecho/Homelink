import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../api/client';
import ProductCard from '../components/ProductCard';

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const category = searchParams.get('category') || '';

  useEffect(() => {
    api.get('/products/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    api.get(`/products?${params}`).then(setProducts).catch(() => {});
  }, [category, search]);

  const handleSearch = (e) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    if (search) p.set('search', search); else p.delete('search');
    setSearchParams(p);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-3xl font-bold text-brand-navy mb-2">Products</h1>
      <p className="text-gray-600 mb-8">Browse our wide selection of home improvement products</p>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-56 shrink-0">
          <h3 className="font-semibold mb-3">Categories</h3>
          <ul className="space-y-1">
            <li>
              <button onClick={() => { const p = new URLSearchParams(searchParams); p.delete('category'); setSearchParams(p); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${!category ? 'bg-brand-navy text-white' : 'hover:bg-gray-100'}`}>
                All Products
              </button>
            </li>
            {categories.map(c => (
              <li key={c.id}>
                <button onClick={() => { const p = new URLSearchParams(searchParams); p.set('category', c.slug); setSearchParams(p); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${category === c.slug ? 'bg-brand-navy text-white' : 'hover:bg-gray-100'}`}>
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex-1">
          <form onSubmit={handleSearch} className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10" />
          </form>
          {products.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No products found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
