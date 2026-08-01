import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../api/client';
import ServiceCard from '../components/ServiceCard';

export default function Services() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const category = searchParams.get('category') || '';

  useEffect(() => {
    api.get('/services/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    api.get(`/services?${params}`).then(setServices).catch(() => {});
  }, [category, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-3xl font-bold text-brand-navy mb-2">Professional Services</h1>
      <p className="text-gray-600 mb-8">Book verified technicians for installation, maintenance, and repair</p>

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setSearchParams({})} className={`px-4 py-2 rounded-full text-sm font-medium transition ${!category ? 'bg-brand-navy text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>All</button>
        {categories.map(c => (
          <button key={c} onClick={() => setSearchParams({ category: c })} className={`px-4 py-2 rounded-full text-sm font-medium transition ${category === c ? 'bg-brand-navy text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>{c}</button>
        ))}
      </div>

      <form onSubmit={e => { e.preventDefault(); }} className="relative mb-8 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input type="text" placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10" />
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map(s => <ServiceCard key={s.id} service={s} />)}
      </div>
    </div>
  );
}
