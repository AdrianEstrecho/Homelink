import { useEffect, useState } from 'react';
import { Package, Wrench, PieChart, Printer } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

function BarList({ items, valueKey, subKey, color, emptyLabel }) {
  const max = Math.max(1, ...items.map(i => Number(i[valueKey]) || 0));
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-4">
      {items.map(item => {
        const value = Number(item[valueKey]) || 0;
        const pct = Math.max(2, Math.round((value / max) * 100));
        return (
          <div key={item.id}>
            <div className="flex items-center justify-between gap-3 text-sm mb-1">
              <span className="font-medium text-gray-700 truncate">{item.name}</span>
              <span className="font-semibold text-gray-900 shrink-0">{formatPrice(value)}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            {(item.category_name || item.category || item[subKey] !== undefined) && (
              <p className="text-xs text-gray-400 mt-1">
                {item.category_name || item.category || '—'}
                {item[subKey] !== undefined && ` · ${item[subKey]} ${subKey === 'units' ? 'sold' : `booking${item[subKey] === 1 ? '' : 's'}`}`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RevenueSources() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/payroll/revenue-sources').then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    const cleanup = () => document.body.classList.remove('printing-active');
    window.addEventListener('afterprint', cleanup);
    return () => { cleanup(); window.removeEventListener('afterprint', cleanup); };
  }, []);

  const handlePrint = () => {
    document.body.classList.add('printing-active');
    window.print();
  };

  if (!data) {
    return (
      <AdminLayout title="Revenue Sources">
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>
      </AdminLayout>
    );
  }

  const { productRevenue, serviceRevenue, topProducts, topServices } = data;
  const total = productRevenue + serviceRevenue;
  const productShare = total > 0 ? Math.round((productRevenue / total) * 100) : 0;
  const serviceShare = total > 0 ? 100 - productShare : 0;

  return (
    <AdminLayout title="Revenue Sources" subtitle="See which products and services your paid revenue is actually coming from.">
      <div className="print-area">
        <div className="hidden print:flex items-center justify-between mb-6">
          <div>
            <p className="font-display text-xl font-bold text-brand-navy">Home<span className="text-brand-orange">Link</span></p>
            <p className="text-xs text-gray-500 tracking-wide uppercase mt-1">Revenue Sources Report</p>
          </div>
          <p className="text-xs text-gray-500">Generated {new Date().toLocaleString()}</p>
        </div>

        <div className="flex items-center justify-end mb-4 no-print">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>

        <div className="card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-brand-navy" />
            <h3 className="font-semibold text-gray-900">Products vs. Services</h3>
          </div>
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <p className="text-xs text-gray-400 flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-brand-orange" /> Product Revenue</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatPrice(productRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5 text-[#00806f]" /> Service Revenue</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatPrice(serviceRevenue)}</p>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
            {productShare > 0 && <div className="h-full bg-brand-orange" style={{ width: `${productShare}%` }} />}
            {serviceShare > 0 && <div className="h-full bg-[#00806f]" style={{ width: `${serviceShare}%` }} />}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-1.5">
            <span>{productShare}% products</span>
            <span>{serviceShare}% services</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 print:grid-cols-1 gap-6">
          <div className="card p-6 print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-brand-orange" />
              <h3 className="font-semibold text-gray-900">Top Products by Revenue</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">From paid orders</p>
            <BarList items={topProducts} valueKey="revenue" subKey="units" color="#ff6b35" emptyLabel="No paid product orders yet." />
          </div>

          <div className="card p-6 print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="w-4 h-4 text-[#00806f]" />
              <h3 className="font-semibold text-gray-900">Top Services by Revenue</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">From paid bookings</p>
            <BarList items={topServices} valueKey="revenue" subKey="bookings" color="#00806f" emptyLabel="No paid service bookings yet." />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
