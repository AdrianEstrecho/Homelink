import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-20">
      <div className="text-center max-w-md">
        <p className="font-display text-8xl font-bold text-brand-navy/10 leading-none mb-2">404</p>
        <h1 className="font-display text-2xl font-bold text-brand-navy mb-3">Page not found</h1>
        <p className="text-gray-600 mb-8">The page you're looking for doesn't exist or may have moved.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-primary flex items-center gap-2">
            <Home className="w-4 h-4" /> Back to Home
          </Link>
          <Link to="/products" className="btn-outline flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Browse Products
          </Link>
        </div>
      </div>
    </div>
  );
}
