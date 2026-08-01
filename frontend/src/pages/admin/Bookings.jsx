import { useEffect, useMemo, useState } from 'react';
import { Pencil, Search, RefreshCw, Wrench } from 'lucide-react';
import { api, formatPrice, statusColor } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import Select from '../../components/Select';
import ConfirmDialog from '../../components/ConfirmDialog';

const STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
const statusLabel = (s) => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const STATUS_OPTIONS = STATUSES.map(s => ({ value: s, label: statusLabel(s) }));

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [installers, setInstallers] = useState([]);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [confirmStatus, setConfirmStatus] = useState(null);
  const [confirmAssign, setConfirmAssign] = useState(null);

  const load = () => {
    api.get('/admin/bookings').then(setBookings).catch(() => {});
    api.get('/admin/users?role=employee&position=installer').then(setInstallers).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const assign = async (bookingId, employeeId) => {
    await api.put(`/admin/bookings/${bookingId}`, { employeeId });
    load();
  };

  const updateStatus = async (id, status) => {
    await api.put(`/admin/bookings/${id}`, { status });
    setEditingId(null);
    load();
  };

  const confirmStatusChange = () => { updateStatus(confirmStatus.id, confirmStatus.status); setConfirmStatus(null); };

  const assignTarget = confirmAssign ? installers.find(i => i.id === confirmAssign.employeeId) : null;
  const isUnassign = !!confirmAssign && !confirmAssign.employeeId;
  const confirmAssignChange = () => { assign(confirmAssign.bookingId, confirmAssign.employeeId); setConfirmAssign(null); };

  const counts = useMemo(() => {
    const c = { all: bookings.length };
    STATUSES.forEach(s => { c[s] = bookings.filter(b => b.status === s).length; });
    return c;
  }, [bookings]);

  const filtered = useMemo(() => {
    return bookings
      .filter(b => tab === 'all' || b.status === tab)
      .filter(b => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return `${b.first_name} ${b.last_name}`.toLowerCase().includes(q) || b.service_name.toLowerCase().includes(q);
      });
  }, [bookings, tab, search]);

  return (
    <AdminLayout title="Bookings" subtitle="View and manage service bookings.">
      <ConfirmDialog
        open={!!confirmStatus}
        icon={RefreshCw}
        tone="update"
        title={confirmStatus ? `Change status to "${STATUS_OPTIONS.find(o => o.value === confirmStatus.status)?.label}"?` : ''}
        message="This updates the status shown to the customer."
        confirmLabel="Change Status"
        onConfirm={confirmStatusChange}
        onCancel={() => setConfirmStatus(null)}
      />
      <ConfirmDialog
        open={!!confirmAssign}
        icon={Wrench}
        tone="update"
        title={isUnassign ? 'Unassign this booking?' : `Assign to ${assignTarget?.first_name} ${assignTarget?.last_name}?`}
        message={isUnassign ? 'The technician will be removed from this booking.' : 'The booking will be marked confirmed and the technician assigned.'}
        confirmLabel={isUnassign ? 'Unassign' : 'Assign'}
        onConfirm={confirmAssignChange}
        onCancel={() => setConfirmAssign(null)}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>All ({counts.all})</TabButton>
        {STATUSES.map(s => (
          <TabButton key={s} active={tab === s} onClick={() => setTab(s)}>
            <span className="capitalize">{s.replace('_', ' ')}</span> ({counts[s] || 0})
          </TabButton>
        ))}
      </div>

      {installers.length === 0 && (
        <p className="text-xs text-gray-500 mb-4">
          No employees are set as <strong>Installer</strong> yet — promote one from the Users page to make them assignable here.
        </p>
      )}

      <div className="card p-3 mb-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer or service..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent outline-none transition"
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium">Service</th>
              <th className="p-3 font-medium">Scheduled</th>
              <th className="p-3 font-medium">Technician</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium text-right">Amount</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">No bookings found.</td></tr>
            ) : filtered.map(b => (
              <tr key={b.id} className="border-t border-gray-100">
                <td className="p-3">
                  <p className="font-medium text-gray-800">{b.first_name} {b.last_name}</p>
                  <p className="text-xs text-gray-400">{b.phone}</p>
                </td>
                <td className="p-3 text-gray-600">{b.service_name}</td>
                <td className="p-3 text-gray-600 whitespace-nowrap">{b.scheduled_date} <span className="text-gray-400">{b.scheduled_time}</span></td>
                <td className="p-3">
                  <Select
                    value={b.employee_id || ''}
                    onChange={employeeId => setConfirmAssign({ bookingId: b.id, employeeId })}
                    options={[{ value: '', label: 'Unassigned' }, ...installers.map(i => ({ value: i.id, label: `${i.first_name} ${i.last_name}` }))]}
                    className="w-40"
                  />
                </td>
                <td className="p-3">
                  {editingId === b.id ? (
                    <Select
                      defaultOpen
                      value={b.status}
                      onChange={status => setConfirmStatus({ id: b.id, status })}
                      onClose={() => setEditingId(null)}
                      options={STATUS_OPTIONS}
                      className="w-40"
                    />
                  ) : (
                    <span className={`badge capitalize ${statusColor(b.status)}`}>{b.status.replace('_', ' ')}</span>
                  )}
                </td>
                <td className="p-3 text-right font-medium">{formatPrice(b.price)}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end">
                    <button onClick={() => setEditingId(b.id)} title="Change status" className="p-1.5 rounded-lg bg-brand-navy/10 text-brand-navy hover:bg-brand-navy/20 transition">
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
