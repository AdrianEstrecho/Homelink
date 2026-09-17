import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { api } from '../api/client';

export default function Policies() {
  const [policies, setPolicies] = useState([]);

  useEffect(() => { api.get('/policies').then(setPolicies).catch(() => {}); }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 md:py-20">
      <div className="text-center mb-16">
        <p className="eyebrow justify-center mb-4"><Shield className="w-3.5 h-3.5" /> Trust &amp; Safety</p>
        <h1 className="section-title">Policies</h1>
        <p className="text-gray-500 mt-3">Your trust and satisfaction are our priority.</p>
      </div>
      <div className="divide-y divide-gray-100 border-t border-gray-100">
        {policies.map(p => (
          <div key={p.id} className="py-8 flex gap-5">
            <Shield className="w-5 h-5 text-brand-navy shrink-0 mt-1" />
            <div>
              <h2 className="font-display font-bold text-lg text-brand-ink mb-2">{p.title}</h2>
              <p className="text-gray-500 leading-relaxed">{p.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
