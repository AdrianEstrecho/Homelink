import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Search } from 'lucide-react';
import { api, formatPrice, statusColor } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState(STATUSES.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);

  const load = () => api.get('/admin/orders').then(setOrders).catch(() => {});
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    await api.put(`/admin/orders/${id}/status`, { status });
    setEditingId(null);
    load();
  };

  const counts = useMemo(() => {
    const c = { all: orders.length };
    STATUSES.forEach(s => { c[s] = orders.filter(o => o.status === s).length; });
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    return orders
      .filter(o => tab === 'all' || o.status === tab)
      .filter(o => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return `${o.first_name} ${o.last_name}`.toLowerCase().includes(q) || o.id.toLowerCase().includes(q);
      });
  }, [orders, tab, search]);

  return (
    <AdminLayout title="Orders" subtitle="View and manage customer orders.">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>All ({counts.all})</TabButton>
        {STATUSES.map(s => (
          <TabButton key={s} active={tab === s} onClick={() => setTab(s)}>
            <span className="capitalize">{s}</span> ({counts[s] || 0})
          </TabButton>
        ))}
      </div>

      <div className="card p-3 mb-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer or order ID..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent outline-none transition"
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium">Order ID</th>
              <th className="p-3 font-medium">Items</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium text-right">Amount</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">No orders found.</td></tr>
            ) : filtered.map(o => (
              <tr key={o.id} className="border-t border-gray-100">
                <td className="p-3">
                  <p className="font-medium text-gray-800">{o.first_name} {o.last_name}</p>
                  <p className="text-xs text-gray-400">{o.email}</p>
                </td>
                <td className="p-3 text-gray-500 font-mono text-xs">#{o.id.slice(0, 8).toUpperCase()}</td>
                <td className="p-3 text-gray-600">{o.items?.length || 0} item{o.items?.length === 1 ? '' : 's'}</td>
                <td className="p-3">
                  {editingId === o.id ? (
                    <select
                      autoFocus
                      value={o.status}
                      onChange={e => updateStatus(o.id, e.target.value)}
                      onBlur={() => setEditingId(null)}
                      className="input-field w-auto text-xs py-1"
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span className={`badge capitalize ${statusColor(o.status)}`}>{o.status}</span>
                  )}
                </td>
                <td className="p-3 text-right font-medium">{formatPrice(o.total)}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end">
                    <button onClick={() => setEditingId(o.id)} title="Change status" className="p-1.5 rounded-lg bg-brand-navy/10 text-brand-navy hover:bg-brand-navy/20 transition">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${active ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  );
}
