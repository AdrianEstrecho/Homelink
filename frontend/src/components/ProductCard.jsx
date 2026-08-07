import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Star, Check, Heart } from 'lucide-react';
import { formatPrice } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import SafeImage from './SafeImage';
import StarRating from './account/StarRating';
import ConfirmDialog from './ConfirmDialog';

export default function ProductCard({ product }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { has, addItem: addWishlistItem, removeItem: removeWishlistItem } = useWishlist();
  const { showToast } = useToast();
  const [confirmUnfavorite, setConfirmUnfavorite] = useState(false);
  const [confirmAddToCart, setConfirmAddToCart] = useState(false);
  const outOfStock = product.stock === 0;
  const lowStock = !outOfStock && product.stock <= 5;
  const wishlisted = has(product.id);

  const addToCart = () => {
    addItem(product);
    if (wishlisted) removeWishlistItem(product.id);
    showToast({
      icon: Check,
      iconClass: 'bg-green-100 text-green-600',
      image: product.image,
      title: 'Added to cart',
      description: product.name,
      action: { label: 'View Cart', to: '/cart' },
    });
  };

  const handleAdd = () => {
    if (user?.role !== 'customer') { navigate('/login'); return; }
    if (wishlisted) { setConfirmAddToCart(true); return; }
    addToCart();
  };

  const handleConfirmAddToCart = () => {
    addToCart();
    setConfirmAddToCart(false);
  };

  const handleWishlistToggle = (e) => {
    e.preventDefault();
    if (user?.role !== 'customer') { navigate('/login'); return; }
    if (wishlisted) { setConfirmUnfavorite(true); return; }
    addWishlistItem(product);
  };

  const handleConfirmUnfavorite = () => {
    removeWishlistItem(product.id);
    setConfirmUnfavorite(false);
  };

  return (
    <>
    <div className="card group hover:border-brand-navy/20 hover:shadow-md h-full flex flex-col">
      <div className="relative overflow-hidden bg-gray-100">
        <Link to={`/products/${product.slug}`} className="block">
          <SafeImage
            src={product.image}
            alt={product.name}
            className="w-full h-48 object-cover group-hover:scale-105 transition duration-500"
          />
        </Link>
        {product.featured && (
          <span className="absolute top-3 left-3 badge bg-brand-orange text-white flex items-center gap-1">
            <Star className="w-3 h-3" /> Featured
          </span>
        )}
        {outOfStock ? (
          <span className="absolute top-12 right-3 badge bg-gray-700 text-white">Out of Stock</span>
        ) : lowStock && (
          <span className="absolute top-12 right-3 badge bg-red-500 text-white">Low Stock</span>
        )}
        <button
          onClick={handleWishlistToggle}
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={wishlisted}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm hover:scale-110 transition"
        >
          <Heart className={`w-4 h-4 transition ${wishlisted ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
        </button>
      </div>
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
        <p className={`text-xs font-medium mb-2 ${outOfStock ? 'text-red-600' : lowStock ? 'text-red-500' : 'text-gray-400'}`}>
          {outOfStock ? 'Out of stock' : lowStock ? `Only ${product.stock} left in stock` : `${product.stock} in stock`}
        </p>
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
    <ConfirmDialog
      open={confirmUnfavorite}
      icon={Heart}
      title="Remove from wishlist?"
      message={`"${product.name}" will be removed from your saved items.`}
      confirmLabel="Remove"
      tone="delete"
      onConfirm={handleConfirmUnfavorite}
      onCancel={() => setConfirmUnfavorite(false)}
    />
    <ConfirmDialog
      open={confirmAddToCart}
      icon={ShoppingCart}
      title="Add to cart?"
      message={`"${product.name}" will be added to your cart and removed from your wishlist.`}
      confirmLabel="Add to Cart"
      tone="create"
      onConfirm={handleConfirmAddToCart}
      onCancel={() => setConfirmAddToCart(false)}
    />
    </>
  );
}
