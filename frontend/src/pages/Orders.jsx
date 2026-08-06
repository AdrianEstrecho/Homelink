import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ShoppingBag, XCircle } from 'lucide-react';
import { api, formatPrice, statusColor } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import OrderDetailsModal from '../components/OrderDetailsModal';
import CancelReasonModal from '../components/CancelReasonModal';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  useEffect(() => { api.get('/orders/my').then(setOrders).catch(() => {}); }, []);

  const submitCancel = async (reason) => {
    const order = cancelTarget;
    await api.put(`/orders/${order.id}/cancel`, { reason });
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cancelled', cancel_reason: reason } : o));
    setSelectedOrder(prev => prev && prev.id === order.id ? { ...prev, status: 'cancelled', cancel_reason: reason } : prev);
    setCancelTarget(null);
    showToast({ icon: XCircle, iconClass: 'bg-red-100 text-red-600', title: 'Order cancelled', description: `Order #${order.id.slice(0, 8).toUpperCase()}` });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-brand-navy transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <p className="eyebrow mb-3">Order History</p>
      <h1 className="section-title mb-8">My Orders</h1>
      {orders.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No orders yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <button
              key={o.id}
              onClick={() => setSelectedOrder(o)}
              className="card p-5 w-full text-left flex flex-wrap items-center justify-between gap-3 hover:border-brand-navy/20 hover:shadow-md transition"
            >
              <div>
                <p className="font-semibold text-brand-ink">Order #{o.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-sm text-gray-500">
                  {new Date(o.created_at).toLocaleDateString()} · {o.items?.length || 0} item{o.items?.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${statusColor(o.status)}`}>{o.status}</span>
                <span className="font-bold text-brand-navy">{formatPrice(o.total)}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          person={user ? { name: `${user.firstName} ${user.lastName}`, email: user.email } : null}
          personLabel="Billed To"
          onCancelOrder={setCancelTarget}
        />
      )}

      <CancelReasonModal
        open={!!cancelTarget}
        title="Cancel this order?"
        message="This can't be undone once submitted. Let us know why you're cancelling."
        onSubmit={submitCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
