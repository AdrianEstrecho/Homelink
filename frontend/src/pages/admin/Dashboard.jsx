import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ShoppingCart, Calendar, DollarSign, AlertTriangle, ArrowRight, Plus, Pencil, Trash2, LogIn, Archive } from 'lucide-react';
import { api, formatPrice, statusColor } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import RevenueChart from '../../components/admin/RevenueChart';
import { useAuth } from '../../context/AuthContext';
import { ACTION_META, timeAgo } from '../../data/auditActions';

const STATUS_ORDER = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const STATUS_BAR_FILL = {
  pending: 'bg-yellow-400',
  processing: 'bg-blue-400',
  shipped: 'bg-purple-400',
  delivered: 'bg-green-400',
  cancelled: 'bg-red-400',
};

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
    { label: 'Total Revenue', value: formatPrice(stats.revenue), icon: DollarSign },
    { label: 'Customers', value: stats.totalCustomers, icon: Users },
    { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingCart },
    { label: 'Bookings', value: stats.totalBookings, icon: Calendar },
  ];

  const totalStatusCount = orderStatusBreakdown.reduce((s, r) => s + r.count, 0) || 1;
  const statusRows = STATUS_ORDER
    .map(status => ({ status, count: orderStatusBreakdown.find(r => r.status === status)?.count || 0 }))
    .filter(r => r.count > 0 || STATUS_ORDER.indexOf(r.status) < 2);

  return (
    <AdminLayout title="Dashboard" subtitle={`Welcome back, ${user?.firstName || 'Admin'}. Here's what's happening with your store today.`}>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {cards.map(c => (
          <div key={c.label} className="card p-4">
            <div className="w-10 h-10 bg-brand-navy/10 rounded-lg flex items-center justify-center mb-3">
              <c.icon className="w-5 h-5 text-brand-navy" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-sm text-gray-500">{c.label}</p>
          </div>
        ))}

        <Link
          to="/admin/products"
          className="rounded-xl p-4 bg-gradient-to-br from-brand-navy via-brand-blue to-brand-navy text-white hover:shadow-lg transition-shadow flex flex-col justify-between"
        >
          <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center mb-3">
            <AlertTriangle className="w-5 h-5 text-brand-orange" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.lowStockCount}</p>
            <p className="text-sm text-gray-300">Low Stock Items</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Revenue Overview</h3>
              <p className="text-xs text-gray-400">Monthly performance for the current year</p>
            </div>
          </div>
          <RevenueChart data={salesByMonth} />
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Order Status</h3>
          <p className="text-xs text-gray-400 mb-4">Breakdown of all orders</p>
          <div className="space-y-4">
            {statusRows.map(r => {
              const pct = Math.round((r.count / totalStatusCount) * 100);
              const textClass = statusColor(r.status).split(' ')[1];
              return (
                <div key={r.status}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className={`capitalize font-medium ${textClass}`}>{r.status}</span>
                    <span className="text-gray-500">{r.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${STATUS_BAR_FILL[r.status] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Recent Orders</h3>
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
              <h3 className="font-semibold text-gray-900">Recent Activity</h3>
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
            <div className="space-y-4">
              {activity.map(log => {
                const meta = ACTION_META[log.action];
                const { Icon, className } = CATEGORY_ICON[meta?.category] || { Icon: Pencil, className: 'bg-gray-100 text-gray-600' };
                return (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${className}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 leading-snug truncate">{meta && log.details ? meta.describe(log.details, nameOf) : log.action}</p>
                      <p className="text-xs text-gray-400">{log.first_name ? `${log.first_name} ${log.last_name}` : 'Deleted user'} · {timeAgo(log.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
