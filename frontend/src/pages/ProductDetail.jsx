import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Check } from 'lucide-react';
import { api, formatPrice } from '../api/client';
import { useCart } from '../context/CartContext';

export default function ProductDetail() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  useEffect(() => {
    api.get(`/products/${slug}`).then(setProduct).catch(() => {});
  }, [slug]);

  if (!product) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>;

  const handleAdd = () => {
    addItem(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/products" className="inline-flex items-center gap-1 text-brand-navy hover:text-brand-orange mb-6 text-sm font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Products
      </Link>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="card">
          <img src={product.image} alt={product.name} className="w-full h-96 object-cover" />
        </div>
        <div>
          <span className="badge bg-brand-teal/10 text-brand-teal mb-3">{product.category_name}</span>
          <h1 className="font-display text-3xl font-bold text-brand-navy mb-4">{product.name}</h1>
          <p className="text-3xl font-bold text-brand-orange mb-6">{formatPrice(product.price)}</p>
          <p className="text-gray-600 mb-6 leading-relaxed">{product.description}</p>

          {Object.keys(product.specifications || {}).length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Specifications</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(product.specifications).map(([k, v]) => (
                  <div key={k} className="bg-gray-50 px-3 py-2 rounded-lg">
                    <dt className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <p className="text-sm mb-4">
            {product.stock > 0 ? <span className="text-green-600 font-medium">{product.stock} in stock</span> : <span className="text-red-600 font-medium">Out of stock</span>}
          </p>

          <div className="flex items-center gap-4">
            <div className="flex items-center border rounded-lg">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 hover:bg-gray-100">-</button>
              <span className="px-4 py-2 font-medium">{qty}</span>
              <button onClick={() => setQty(Math.min(product.stock, qty + 1))} className="px-3 py-2 hover:bg-gray-100">+</button>
            </div>
            <button onClick={handleAdd} disabled={product.stock === 0} className="btn-primary flex items-center gap-2 flex-1 justify-center disabled:opacity-50">
              {added ? <><Check className="w-5 h-5" /> Added!</> : <><ShoppingCart className="w-5 h-5" /> Add to Cart</>}
            </button>
          </div>

          <Link to="/services" className="block mt-4 text-center text-sm text-brand-teal hover:underline">
            Need installation? Book a professional service →
          </Link>
        </div>
      </div>
    </div>
  );
}
