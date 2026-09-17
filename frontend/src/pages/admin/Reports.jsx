import { useEffect, useState } from 'react';
import { DollarSign, ShoppingCart, Calendar, TrendingUp, Download, Users, UserPlus, Repeat } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import RevenueChart from '../../components/admin/RevenueChart';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'products', label: 'Products & Services' },
  { key: 'customers', label: 'Customers' },
];

function downloadCsv(filename, headers, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map(row => row.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ExportButton({ onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-xs font-semibold text-brand-navy hover:text-brand-orange transition">
      <Download className="w-3.5 h-3.5" /> Export CSV
    </button>
  );
}

export default function AdminReports() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => { api.get('/admin/reports').then(setData).catch(() => {}); }, []);

  if (!data) {
    return (
      <AdminLayout title="Reports">
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>
      </AdminLayout>
    );
  }

  const { totals, salesByMonth, byCategory, topProducts, topServices, topCustomers, customerInsights } = data;
  const maxCategoryRevenue = Math.max(1, ...byCategory.map(c => c.revenue));

  const cards = [
    { label: 'Total Revenue', value: formatPrice(totals.revenue), icon: DollarSign },
    { label: 'Paid Orders', value: totals.orders, icon: ShoppingCart },
    { label: 'Paid Bookings', value: totals.bookings, icon: Calendar },
    { label: 'Avg Order Value', value: formatPrice(totals.avgOrderValue), icon: TrendingUp },
  ];

  return (
    <AdminLayout title="Reports" subtitle="Sales performance, product/service rankings, and customer insights.">
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${tab === t.key ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map(c => (
              <div key={c.label} className="card p-4">
                <div className="w-10 h-10 bg-brand-navy/10 rounded-lg flex items-center justify-center mb-3">
                  <c.icon className="w-5 h-5 text-brand-navy" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                <p className="text-sm text-gray-500">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Revenue Overview</h3>
                  <p className="text-xs text-gray-400">Monthly performance for the current year</p>
                </div>
                <ExportButton onClick={() => downloadCsv('revenue-by-month.csv', ['Month', 'Orders', 'Revenue'], salesByMonth.map(m => [m.month, m.orders ?? '', m.revenue]))} />
              </div>
              <RevenueChart data={salesByMonth} />
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-gray-900">Revenue by Category</h3>
                <ExportButton onClick={() => downloadCsv('revenue-by-category.csv', ['Category', 'Units', 'Revenue'], byCategory.map(c => [c.name, c.units, c.revenue]))} />
              </div>
              <p className="text-xs text-gray-400 mb-4">Product sales breakdown</p>
              {byCategory.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No category sales yet.</p>
              ) : (
                <div className="space-y-4">
                  {byCategory.map(c => (
                    <div key={c.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{c.name}</span>
                        <span className="text-gray-500">{formatPrice(c.revenue)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-[#00806f]" style={{ width: `${(c.revenue / maxCategoryRevenue) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Top Products</h3>
              <ExportButton onClick={() => downloadCsv('top-products.csv', ['Product', 'Units Sold', 'Revenue'], topProducts.map(p => [p.name, p.units_sold, p.revenue]))} />
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="p-3 font-medium">Product</th>
                  <th className="p-3 font-medium text-right">Units</th>
                  <th className="p-3 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.length === 0 ? (
                  <tr><td colSpan={3} className="p-8 text-center text-gray-400">No product sales yet.</td></tr>
                ) : topProducts.map(p => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="p-3 text-gray-800">{p.name}</td>
                    <td className="p-3 text-right text-gray-600">{p.units_sold}</td>
                    <td className="p-3 text-right font-medium">{formatPrice(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Top Services</h3>
              <ExportButton onClick={() => downloadCsv('top-services.csv', ['Service', 'Bookings', 'Revenue'], topServices.map(s => [s.name, s.bookings, s.revenue]))} />
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="p-3 font-medium">Service</th>
                  <th className="p-3 font-medium text-right">Bookings</th>
                  <th className="p-3 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topServices.length === 0 ? (
                  <tr><td colSpan={3} className="p-8 text-center text-gray-400">No bookings yet.</td></tr>
                ) : topServices.map(s => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="p-3 text-gray-800">{s.name}</td>
                    <td className="p-3 text-right text-gray-600">{s.bookings}</td>
                    <td className="p-3 text-right font-medium">{formatPrice(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'customers' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Paying Customers', value: customerInsights.payingCustomers, icon: Users },
              { label: 'New This Month', value: customerInsights.newCustomersThisMonth, icon: UserPlus },
              { label: 'Repeat Customer Rate', value: `${customerInsights.repeatCustomerRate}%`, icon: Repeat },
            ].map(c => (
              <div key={c.label} className="card p-4">
                <div className="w-10 h-10 bg-brand-navy/10 rounded-lg flex items-center justify-center mb-3">
                  <c.icon className="w-5 h-5 text-brand-navy" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                <p className="text-sm text-gray-500">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Top Customers</h3>
              <ExportButton onClick={() => downloadCsv('top-customers.csv', ['Name', 'Email', 'Orders', 'Total Spent'], topCustomers.map(c => [`${c.first_name} ${c.last_name}`, c.email, c.orders, c.total_spent]))} />
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="p-3 font-medium">Customer</th>
                  <th className="p-3 font-medium text-right">Orders</th>
                  <th className="p-3 font-medium text-right">Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.length === 0 ? (
                  <tr><td colSpan={3} className="p-8 text-center text-gray-400">No paying customers yet.</td></tr>
                ) : topCustomers.map(c => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="p-3">
                      <p className="text-gray-800 font-medium">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-gray-400">{c.email}</p>
                    </td>
                    <td className="p-3 text-right text-gray-600">{c.orders}</td>
                    <td className="p-3 text-right font-medium">{formatPrice(c.total_spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
