import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, AlertTriangle, PackageX, Archive, ArrowRight } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import StatTile from '../../components/admin/StatTile';
import { useAuth } from '../../context/AuthContext';

export default function InventoryDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/products/stats').then(setData).catch(() => {});
  }, []);

  if (!data) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>
      </AdminLayout>
    );
  }

  const { totalProducts, archivedCount, lowStockCount, outOfStockCount, categoryBreakdown, recentProducts } = data;
  const cards = [
    { label: 'Active products', value: totalProducts, icon: Package },
    { label: 'Out of stock', value: outOfStockCount, icon: PackageX },
    { label: 'Archived', value: archivedCount, icon: Archive },
  ];
  const maxCategoryCount = Math.max(...categoryBreakdown.map(c => c.count), 1);

  return (
    <AdminLayout title="Dashboard" subtitle={`Welcome back, ${user?.firstName || 'there'}. Here's your product & stock overview.`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(c => <StatTile key={c.label} label={c.label} value={c.value} icon={c.icon} />)}
        <StatTile label="Low stock items" value={lowStockCount} icon={AlertTriangle} tone={lowStockCount > 0 ? 'alert' : 'default'} to="/admin/products" action="Review stock" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Recently added products</h3>
              <p className="text-xs text-gray-400">Latest additions to the catalog</p>
            </div>
            <Link to="/admin/products" className="text-xs font-semibold text-brand-navy hover:text-brand-orange transition flex items-center gap-1 whitespace-nowrap">
              Manage products <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentProducts.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No products yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                    <th className="font-medium pb-2">Product</th>
                    <th className="font-medium pb-2">Stock</th>
                    <th className="font-medium pb-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProducts.map(p => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="py-2.5">{p.name}</td>
                      <td className="py-2.5">
                        <span className={p.stock === 0 ? 'text-red-600 font-semibold' : p.stock <= 5 ? 'text-amber-600 font-semibold' : 'text-gray-700'}>{p.stock}</span>
                      </td>
                      <td className="py-2.5 text-right font-medium">{formatPrice(p.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Top categories</h3>
          <p className="text-xs text-gray-400 mb-5">Product count by category</p>
          {categoryBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No categories yet.</p>
          ) : (
            <div className="space-y-4">
              {categoryBreakdown.map(c => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-700 truncate">{c.name}</span>
                    <span className="tabular-nums font-medium text-gray-900">{c.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-brand-blue" style={{ width: `${Math.round((c.count / maxCategoryCount) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
