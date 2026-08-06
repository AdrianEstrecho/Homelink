import { Link } from 'react-router-dom';
import { Wrench, Clock, ArrowRight } from 'lucide-react';
import { formatPrice } from '../api/client';
import SafeImage from './SafeImage';

export default function ServiceCard({ service }) {
  return (
    <div className="card hover:border-brand-navy/20 hover:shadow-md group h-full flex flex-col">
      <div className="relative h-40 overflow-hidden bg-gray-100">
        <SafeImage
          src={service.image}
          alt={service.name}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/80 to-transparent" />
        <span className="absolute bottom-3 left-3 badge bg-brand-teal text-white">{service.category}</span>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display font-bold text-brand-ink text-lg mb-2">{service.name}</h3>
        <p className="text-gray-500 text-sm mb-4 line-clamp-2 leading-relaxed">{service.description}</p>
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4 mt-auto pt-3 border-t border-gray-100">
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> ~{Number(service.duration_hours).toFixed(1)}h</span>
          <span className="font-bold text-brand-orange text-base">{formatPrice(service.base_price)}</span>
        </div>
        <Link to={`/services/${service.slug}/book`} className="flex items-center justify-center gap-2 w-full btn-primary text-sm py-2">
          <Wrench className="w-4 h-4" /> Book Service <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
