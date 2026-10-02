import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Clock, Truck, CheckCircle, ArrowRight } from 'lucide-react';
import { api, formatPrice, statusColor } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import StatTile from '../../components/admin/StatTile';
import StatusBars from '../../components/admin/StatusBars';
import { useAuth } from '../../context/AuthContext';

const STATUS_ORDER = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function OrdersDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/orders/stats').then(setData).catch(() => {});
  }, []);

  if (!data) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>
      </AdminLayout>
    );
  }

  const { totalOrders, revenue, statusBreakdown, recentOrders } = data;
  const countOf = (status) => statusBreakdown.find(r => r.status === status)?.count || 0;
  const cards = [
    { label: 'Total orders', value: totalOrders, icon: ShoppingCart },
    { label: 'Pending', value: countOf('pending'), icon: Clock },
    { label: 'Shipped', value: countOf('shipped'), icon: Truck },
    { label: 'Delivered', value: countOf('delivered'), icon: CheckCircle },
  ];
  const totalStatusCount = statusBreakdown.reduce((s, r) => s + r.count, 0) || 1;
  const statusRows = STATUS_ORDER.map(status => ({ status, count: countOf(status) })).filter(r => r.count > 0);

  return (
    <AdminLayout title="Dashboard" subtitle={`Welcome back, ${user?.firstName || 'there'}. Here's your order fulfillment overview.`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(c => <StatTile key={c.label} label={c.label} value={c.value} icon={c.icon} tone={c.tone} to={c.to} action={c.action} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Recent orders</h3>
              <p className="text-xs text-gray-400">Latest transactions from the store</p>
            </div>
            <Link to="/admin/orders" className="text-xs font-semibold text-brand-navy hover:text-brand-orange transition flex items-center gap-1 whitespace-nowrap">
              Manage orders <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                    <th className="font-medium pb-2">Customer</th>
                    <th className="font-medium pb-2">Order ID</th>
                    <th className="font-medium pb-2">Status</th>
                    <th className="font-medium pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(o => (
                    <tr key={o.id} className="border-t border-gray-100">
                      <td className="py-2.5">{o.first_name} {o.last_name}</td>
                      <td className="py-2.5 text-gray-500 font-mono text-xs">#{o.id.slice(0, 8).toUpperCase()}</td>
                      <td className="py-2.5"><span className={`badge ${statusColor(o.status)}`}>{o.status}</span></td>
                      <td className="py-2.5 text-right font-medium">{formatPrice(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Order status</h3>
          <p className="text-xs text-gray-400 mb-5">Breakdown of all orders &middot; {formatPrice(revenue)} collected</p>
          <StatusBars rows={statusRows} total={totalStatusCount} />
        </div>
      </div>
    </AdminLayout>
  );
}
