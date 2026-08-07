import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import ProductCard from '../components/ProductCard';
import Reveal from '../components/Reveal';

export default function Wishlist() {
  const { items } = useWishlist();

  if (items.length === 0) {
    return (
      <Reveal className="max-w-2xl mx-auto px-4 py-24 text-center">
        <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-bold text-brand-ink mb-2">Your wishlist is empty</h2>
        <p className="text-gray-500 mb-6">Save products you love to come back to them later.</p>
        <Link to="/products" className="btn-primary">Browse Products</Link>
      </Reveal>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-14">
      <div className="mb-8">
        <p className="eyebrow mb-3">Saved for Later</p>
        <h1 className="section-title">Wishlist</h1>
        <p className="text-gray-500 mt-2">{items.length} item{items.length === 1 ? '' : 's'} saved</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((p, i) => (
          <Reveal key={p.id} delay={(i % 8) * 60} className="h-full">
            <ProductCard product={p} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
