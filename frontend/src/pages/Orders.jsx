import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, formatPrice, statusColor } from '../api/client';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const navigate = useNavigate();

  useEffect(() => { api.get('/orders/my').then(setOrders).catch(() => {}); }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-brand-navy transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="font-display text-3xl font-bold text-brand-navy mb-8">My Orders</h1>
      {orders.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No orders yet.</p>
      ) : (
        <div className="space-y-4">
          {orders.map(o => (
            <div key={o.id} className="card p-6">
              <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
                <div>
                  <p className="font-semibold">Order #{o.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-sm text-gray-500">{new Date(o.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <span className={`badge ${statusColor(o.status)}`}>{o.status}</span>
                  <span className={`badge ${statusColor(o.payment_status)}`}>{o.payment_status}</span>
                </div>
              </div>
              {o.items?.map(i => (
                <div key={i.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                  <span>{i.name} x{i.quantity}</span>
                  <span>{formatPrice(i.price * i.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold mt-3 pt-3 border-t">
                <span>Total {o.discount > 0 && <span className="text-sm text-green-600 font-normal">(₱{o.discount} saved)</span>}</span>
                <span className="text-brand-orange">{formatPrice(o.total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
