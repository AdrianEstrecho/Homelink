import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Gallery() {
  const [items, setItems] = useState([]);

  useEffect(() => { api.get('/gallery').then(setItems).catch(() => {}); }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-brand-navy mb-2">Project Gallery</h1>
      <p className="text-gray-600 mb-8">See our completed home improvement projects</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(g => (
          <div key={g.id} className="card group overflow-hidden">
            <div className="relative overflow-hidden">
              <img src={g.image} alt={g.title} className="w-full h-56 object-cover group-hover:scale-105 transition duration-500" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
            </div>
            <div className="p-4">
              <span className="badge bg-brand-teal/10 text-brand-teal mb-2">{g.category}</span>
              <h3 className="font-semibold">{g.title}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
