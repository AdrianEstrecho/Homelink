import { Link } from 'react-router-dom';
import { ShoppingCart, Star, Check } from 'lucide-react';
import { formatPrice } from '../api/client';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import SafeImage from './SafeImage';
import StarRating from './account/StarRating';

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const { showToast } = useToast();
  const outOfStock = product.stock === 0;

  const handleAdd = () => {
    addItem(product);
    showToast({
      icon: Check,
      iconClass: 'bg-green-100 text-green-600',
      image: product.image,
      title: 'Added to cart',
      description: product.name,
      action: { label: 'View Cart', to: '/cart' },
    });
  };

  return (
    <div className="card group hover:border-brand-navy/20 hover:shadow-md h-full flex flex-col">
      <Link to={`/products/${product.slug}`} className="block relative overflow-hidden bg-gray-100">
        <SafeImage
          src={product.image}
          alt={product.name}
          className="w-full h-48 object-cover group-hover:scale-105 transition duration-500"
        />
        {product.featured && (
          <span className="absolute top-3 left-3 badge bg-brand-orange text-white flex items-center gap-1">
            <Star className="w-3 h-3" /> Featured
          </span>
        )}
        {outOfStock ? (
          <span className="absolute top-3 right-3 badge bg-gray-700 text-white">Out of Stock</span>
        ) : product.stock <= 5 && (
          <span className="absolute top-3 right-3 badge bg-red-500 text-white">Low Stock</span>
        )}
      </Link>
      <div className="p-5 flex flex-col flex-1">
        <p className="text-xs text-brand-teal font-semibold uppercase tracking-wide mb-1.5">{product.category_name}</p>
        <Link to={`/products/${product.slug}`}>
          <h3 className="font-semibold text-brand-ink hover:text-brand-orange transition line-clamp-2 mb-2">{product.name}</h3>
        </Link>
        {product.review_count > 0 && (
          <div className="flex items-center gap-1.5 mb-2">
            <StarRating value={Math.round(product.avg_rating)} readOnly size="w-3.5 h-3.5" />
            <span className="text-xs text-gray-400">({product.review_count})</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 mt-auto pt-2">
          <span className="text-lg font-bold text-brand-navy">{formatPrice(product.price)}</span>
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            aria-label={outOfStock ? `${product.name} is out of stock` : `Add ${product.name} to cart`}
            className="flex items-center gap-1.5 bg-brand-navy hover:bg-brand-blue text-white text-sm px-3 py-1.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-navy"
          >
            <ShoppingCart className="w-4 h-4" /> {outOfStock ? 'Sold Out' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
