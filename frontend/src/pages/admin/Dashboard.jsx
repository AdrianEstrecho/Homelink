import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ShoppingCart, Calendar, DollarSign, AlertTriangle, ArrowRight, Plus, Pencil, Trash2, LogIn, Archive } from 'lucide-react';
import { api, formatPrice, statusColor } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import RevenueChart from '../../components/admin/RevenueChart';
import StatTile from '../../components/admin/StatTile';
import StatusBars from '../../components/admin/StatusBars';
import { useAuth } from '../../context/AuthContext';
import { ACTION_META, timeAgo } from '../../data/auditActions';

const STATUS_ORDER = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const CATEGORY_ICON = {
  create: { Icon: Plus, className: 'bg-green-100 text-green-600' },
  update: { Icon: Pencil, className: 'bg-amber-100 text-amber-600' },
  delete: { Icon: Trash2, className: 'bg-red-100 text-red-600' },
  login: { Icon: LogIn, className: 'bg-blue-100 text-blue-600' },
  archive: { Icon: Archive, className: 'bg-purple-100 text-purple-600' },
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [activity, setActivity] = useState(null);
  const [staff, setStaff] = useState([]);
  const [recentTab, setRecentTab] = useState('products');

  useEffect(() => {
    api.get('/admin/dashboard').then(setData).catch(() => {});
    api.get('/admin/audit-logs?limit=6').then(setActivity).catch(() => {});
    api.get('/admin/users').then(users => setStaff(users.filter(u => u.role !== 'customer'))).catch(() => {});
  }, []);

  if (!data) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>
      </AdminLayout>
    );
  }

  const { stats, orderStatusBreakdown, salesByMonth, recentOrders, recentBookings } = data;
  const nameOf = (id) => {
    const match = staff.find(u => u.id === id);
    return match && `${match.first_name} ${match.last_name}`;
  };

  const cards = [
    // Full width on phones: the peso total is the longest figure and the one that leads.
    { label: 'Total revenue', value: formatPrice(stats.revenue), icon: DollarSign, className: 'col-span-2 md:col-span-1' },
    { label: 'Customers', value: stats.totalCustomers.toLocaleString(), icon: Users },
    { label: 'Total orders', value: stats.totalOrders.toLocaleString(), icon: ShoppingCart },
    { label: 'Bookings', value: stats.totalBookings.toLocaleString(), icon: Calendar },
  ];

  const totalStatusCount = orderStatusBreakdown.reduce((s, r) => s + r.count, 0) || 1;
  const statusRows = STATUS_ORDER
    .map(status => ({ status, count: orderStatusBreakdown.find(r => r.status === status)?.count || 0 }))
    .filter(r => r.count > 0 || STATUS_ORDER.indexOf(r.status) < 2);
  const revenueThisYear = salesByMonth.reduce((sum, m) => sum + m.revenue, 0);

  return (
    <AdminLayout title="Dashboard" subtitle={`Welcome back, ${user?.firstName || 'Admin'}. Here's what's happening with your store today.`}>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {cards.map(c => <StatTile key={c.label} label={c.label} value={c.value} icon={c.icon} className={c.className} />)}
        <StatTile label="Low stock items" value={stats.lowStockCount} icon={AlertTriangle} tone={stats.lowStockCount > 0 ? 'alert' : 'default'} to="/admin/products" action="Review stock" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Revenue overview</h3>
              <p className="text-xs text-gray-400">Monthly performance for the current year</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs text-gray-400">This year</p>
              <p className="text-lg font-semibold text-brand-ink">{formatPrice(revenueThisYear)}</p>
            </div>
          </div>
          <RevenueChart data={salesByMonth} />
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Order status</h3>
          <p className="text-xs text-gray-400 mb-5">Breakdown of all {totalStatusCount.toLocaleString()} orders</p>
          <StatusBars rows={statusRows} total={totalStatusCount} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Recent orders</h3>
              <p className="text-xs text-gray-400">Latest transactions from your store</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setRecentTab('products')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${recentTab === 'products' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Products
                </button>
                <button
                  onClick={() => setRecentTab('services')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${recentTab === 'services' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Services
                </button>
              </div>
              <Link
                to={recentTab === 'products' ? '/admin/orders' : '/admin/bookings'}
                className="text-xs font-semibold text-brand-navy hover:text-brand-orange transition flex items-center gap-1 whitespace-nowrap"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {recentTab === 'products' ? (
            recentOrders.length === 0 ? (
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
            )
          ) : (
            recentBookings.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">No bookings yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                      <th className="font-medium pb-2">Customer</th>
                      <th className="font-medium pb-2">Service</th>
                      <th className="font-medium pb-2">Status</th>
                      <th className="font-medium pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map(b => (
                      <tr key={b.id} className="border-t border-gray-100">
                        <td className="py-2.5">{b.first_name} {b.last_name}</td>
                        <td className="py-2.5 text-gray-600">{b.service_name}</td>
                        <td className="py-2.5"><span className={`badge ${statusColor(b.status)}`}>{b.status.replace('_', ' ')}</span></td>
                        <td className="py-2.5 text-right font-medium">{formatPrice(b.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Recent activity</h3>
              <p className="text-xs text-gray-400">Latest staff actions in your system</p>
            </div>
            <Link to="/admin/audit-log" className="text-xs font-semibold text-brand-navy hover:text-brand-orange transition flex items-center gap-1 whitespace-nowrap">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {!activity ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading...</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No activity recorded yet.</p>
          ) : (
            <ol className="relative">
              {activity.map((log, i) => {
                const meta = ACTION_META[log.action];
                const { Icon, className } = CATEGORY_ICON[meta?.category] || { Icon: Pencil, className: 'bg-gray-100 text-gray-600' };
                return (
                  <li key={log.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
                    {/* The thread between events, stopping at the last one. */}
                    {i < activity.length - 1 && <span className="absolute left-4 top-8 bottom-0 w-px bg-gray-200" aria-hidden="true" />}
                    <div className={`relative w-8 h-8 rounded-full ring-4 ring-white flex items-center justify-center shrink-0 ${className}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm text-gray-800 leading-snug line-clamp-2">{meta && log.details ? meta.describe(log.details, nameOf) : log.action}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{log.first_name ? `${log.first_name} ${log.last_name}` : 'Deleted user'} · {timeAgo(log.created_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
