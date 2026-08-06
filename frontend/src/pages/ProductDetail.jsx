import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Check, ChevronRight, Truck, ShieldCheck, Wrench, Star, Zap } from 'lucide-react';
import { api, formatPrice } from '../api/client';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import ProductCard from '../components/ProductCard';
import SafeImage from '../components/SafeImage';
import { Skeleton } from '../components/Skeleton';
import StarRating from '../components/account/StarRating';

const TABS = ['Description', 'Specifications', 'Reviews'];

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(false);
  const [qty, setQty] = useState(1);
  const { addItem } = useCart();
  const { showToast } = useToast();
  const [reviews, setReviews] = useState(null);
  const [related, setRelated] = useState([]);
  const [tab, setTab] = useState('Description');

  const loadProduct = useCallback(() => {
    setProduct(null);
    setError(false);
    setTab('Description');
    api.get(`/products/${slug}`).then(setProduct).catch(() => setError(true));
  }, [slug]);

  useEffect(() => { loadProduct(); }, [loadProduct]);

  useEffect(() => {
    if (!product) return;
    setQty(1);
    api.get(`/reviews/product/${product.id}`).then(setReviews).catch(() => setReviews({ reviews: [], average: 0, count: 0 }));
    const params = product.category_slug ? `category=${product.category_slug}` : 'featured=true';
    api.get(`/products?${params}&limit=5`)
      .then(data => setRelated(data.filter(p => p.id !== product.id).slice(0, 4)))
      .catch(() => setRelated([]));
  }, [product?.id, product?.category_slug]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20">
        <ErrorState message="Couldn't load this product right now." onRetry={loadProduct} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <Skeleton className="h-4 w-40 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <Skeleton className="w-full h-96 rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const handleAdd = () => {
    addItem(product, qty);
    showToast({
      icon: Check,
      iconClass: 'bg-green-100 text-green-600',
      image: product.image,
      title: 'Added to cart',
      description: `${qty} × ${product.name}`,
      action: { label: 'View Cart', to: '/cart' },
    });
  };

  const handleBuyNow = () => {
    addItem(product, qty);
    navigate('/checkout');
  };

  const inStock = product.stock > 0;
  const lowStock = inStock && product.stock <= 5;
  const specs = Object.entries(product.specifications || {});

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-14">
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-8 flex-wrap" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand-navy transition">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <Link to="/products" className="hover:text-brand-navy transition">Products</Link>
        {product.category_slug && (
          <>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <Link to={`/products?category=${product.category_slug}`} className="hover:text-brand-navy transition">{product.category_name}</Link>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <span className="text-brand-ink font-medium truncate max-w-[14rem]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <Reveal className="card relative">
          <SafeImage src={product.image} alt={product.name} className="w-full h-96 lg:h-[28rem] object-cover" />
          {product.featured && (
            <span className="absolute top-4 left-4 badge bg-brand-orange text-white flex items-center gap-1">
              <Star className="w-3 h-3" /> Featured
            </span>
          )}
          {!inStock ? (
            <span className="absolute top-4 right-4 badge bg-gray-700 text-white">Out of Stock</span>
          ) : lowStock && (
            <span className="absolute top-4 right-4 badge bg-red-500 text-white">Low Stock</span>
          )}
        </Reveal>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Reveal delay={80}>
            <p className="eyebrow text-brand-teal mb-3">{product.category_name}</p>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-brand-ink mb-3">{product.name}</h1>

            {reviews && reviews.count > 0 && (
              <button onClick={() => setTab('Reviews')} className="flex items-center gap-2 mb-4 group">
                <StarRating value={Math.round(reviews.average)} readOnly size="w-4 h-4" />
                <span className="text-sm text-gray-500 group-hover:text-brand-navy transition">
                  {reviews.average.toFixed(1)} ({reviews.count} review{reviews.count === 1 ? '' : 's'})
                </span>
              </button>
            )}

            <p className="text-3xl font-bold text-brand-navy mb-6">{formatPrice(product.price)}</p>
            <p className="text-gray-500 mb-6 leading-relaxed">{product.description}</p>

            <p className="text-sm mb-6">
              {inStock ? (
                <span className="text-green-600 font-medium">{lowStock ? `Only ${product.stock} left in stock` : 'In stock'}</span>
              ) : (
                <span className="text-red-600 font-medium">Out of stock</span>
              )}
            </p>

            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button onClick={() => setQty(Math.max(1, qty - 1))} disabled={!inStock || qty <= 1} className="px-3 py-2.5 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent">-</button>
                <span className="px-4 py-2.5 font-medium w-12 text-center">{qty}</span>
                <button onClick={() => setQty(Math.min(product.stock, qty + 1))} disabled={!inStock || qty >= product.stock} className="px-3 py-2.5 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent">+</button>
              </div>
              <button onClick={handleAdd} disabled={!inStock} className="btn-primary flex items-center gap-2 flex-1 justify-center disabled:opacity-50">
                <ShoppingCart className="w-5 h-5" /> Add to Cart
              </button>
            </div>
            <button onClick={handleBuyNow} disabled={!inStock} className="btn-secondary flex items-center gap-2 w-full justify-center mb-6 disabled:opacity-50">
              <Zap className="w-5 h-5" /> Buy Now
            </button>

            <div className="grid grid-cols-3 gap-3 mb-6 text-center">
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-2 py-3">
                <Truck className="w-5 h-5 text-brand-teal mx-auto mb-1.5" />
                <p className="text-xs text-gray-500 leading-tight">Local Delivery</p>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-2 py-3">
                <ShieldCheck className="w-5 h-5 text-brand-teal mx-auto mb-1.5" />
                <p className="text-xs text-gray-500 leading-tight">Warranty Included</p>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-2 py-3">
                <Wrench className="w-5 h-5 text-brand-teal mx-auto mb-1.5" />
                <p className="text-xs text-gray-500 leading-tight">Pro Install Available</p>
              </div>
            </div>

            <Link to="/services" className="block text-center text-sm text-brand-teal hover:underline">
              Need installation? Book a professional service →
            </Link>
          </Reveal>
        </div>
      </div>

      <Reveal className="mt-16">
        <div className="flex gap-8 border-b border-gray-200 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-4 text-sm font-semibold transition border-b-2 -mb-px whitespace-nowrap ${tab === t ? 'border-brand-orange text-brand-navy' : 'border-transparent text-gray-400 hover:text-brand-navy'}`}
            >
              {t}{t === 'Reviews' && reviews?.count > 0 ? ` (${reviews.count})` : ''}
            </button>
          ))}
        </div>

        <div className="py-8 max-w-3xl">
          {tab === 'Description' && (
            <p className="text-gray-600 leading-relaxed">{product.description || 'No description available.'}</p>
          )}

          {tab === 'Specifications' && (
            specs.length > 0 ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                {specs.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                    <dt className="text-gray-400 capitalize">{k.replace(/([A-Z])/g, ' $1')}</dt>
                    <dd className="font-medium text-brand-ink text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="text-gray-400 text-sm">No specifications listed for this product.</p>
          )}

          {tab === 'Reviews' && (
            !reviews ? (
              <p className="text-gray-400 text-sm">Loading reviews...</p>
            ) : reviews.count === 0 ? (
              <p className="text-gray-400 text-sm">No reviews yet. Be the first to review this product after purchase.</p>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl font-bold text-brand-ink">{reviews.average.toFixed(1)}</span>
                  <div>
                    <StarRating value={Math.round(reviews.average)} readOnly size="w-4 h-4" />
                    <p className="text-xs text-gray-400 mt-0.5">Based on {reviews.count} review{reviews.count === 1 ? '' : 's'}</p>
                  </div>
                </div>
                {reviews.reviews.map(r => (
                  <div key={r.id} className="border-t border-gray-100 pt-5">
                    <div className="flex items-center justify-between mb-1.5 gap-3">
                      <p className="font-semibold text-sm text-brand-ink">{r.first_name} {r.last_name?.[0]}.</p>
                      <span className="text-xs text-gray-400 shrink-0">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <StarRating value={r.rating} readOnly size="w-3.5 h-3.5" />
                    {r.comment && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </Reveal>

      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-brand-ink mb-6">You Might Also Like</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((p, i) => (
              <Reveal key={p.id} delay={i * 60} className="h-full">
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
