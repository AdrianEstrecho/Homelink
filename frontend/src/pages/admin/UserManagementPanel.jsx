import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, ArrowUpCircle, X, Archive, ArchiveRestore } from 'lucide-react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import Select from '../../components/Select';

const POSITION_LABELS = {
  inventory_clerk: 'Inventory Clerk',
  booking_coordinator: 'Booking Coordinator',
  installer: 'Installer / Technician',
  customer_support: 'Customer Support',
  general_staff: 'General Staff',
};

const POSITION_COLORS = {
  inventory_clerk: 'bg-teal-100 text-teal-800',
  booking_coordinator: 'bg-blue-100 text-blue-800',
  installer: 'bg-orange-100 text-orange-800',
  customer_support: 'bg-purple-100 text-purple-800',
  general_staff: 'bg-gray-100 text-gray-700',
};

const POSITION_OPTIONS = Object.entries(POSITION_LABELS).map(([value, label]) => ({ value, label }));

function maskPhone(phone) {
  if (!phone || phone.length < 4) return phone || '—';
  return `${phone.slice(0, 4)}${'•'.repeat(Math.max(0, phone.length - 6))}${phone.slice(-2)}`;
}

function maskAddress(address) {
  if (!address) return '—';
  const words = address.trim().split(/\s+/);
  if (words.length <= 1) return '••••••';
  return `${words[0]} ${'•'.repeat(6)}`;
}

// Shared by Users.jsx (customers), AdminManagement.jsx (employees/admins), and
// ArchivedUsers.jsx (any archived account) — the role tabs and archivedView flag
// decide which slice of the same /admin/users list each page shows.
export default function UserManagementPanel({ roleTabs, title, subtitle, archivedView = false }) {
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState(roleTabs[0].key);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', position: 'general_staff' });
  const [revealed, setRevealed] = useState(new Set());
  const [promotingId, setPromotingId] = useState(null);

  const load = () => api.get('/admin/users').then(setUsers).catch(() => {});
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = {};
    roleTabs.forEach(t => { c[t.key] = users.filter(u => u.role === t.key && !!u.archived === archivedView).length; });
    return c;
  }, [users, roleTabs, archivedView]);

  const filtered = users.filter(u => u.role === tab && !!u.archived === archivedView);

  const toggleReveal = (id) => {
    setRevealed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    await api.post('/admin/users', { ...form, role: 'employee' });
    setShowForm(false);
    setForm({ email: '', password: '', firstName: '', lastName: '', phone: '', position: 'general_staff' });
    load();
  };

  const archiveUser = async (id) => {
    if (!confirm('Archive this user? They will no longer be able to sign in, but their data is kept and can be restored later.')) return;
    await api.put(`/admin/users/${id}/archive`);
    load();
  };
  const restoreUser = async (id) => { await api.put(`/admin/users/${id}/restore`); load(); };
  const deleteForever = async (id) => {
    if (!confirm('Permanently delete this user? This cannot be undone.')) return;
    await api.delete(`/admin/users/${id}`);
    load();
  };

  const promote = async (id, position) => {
    await api.put(`/admin/users/${id}/promote`, { position });
    setPromotingId(null);
    load();
  };

  return (
    <AdminLayout title={title} subtitle={subtitle}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {roleTabs.length > 1 ? (
          <div className="flex items-center gap-2">
            {roleTabs.map(t => (
              <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>{t.label} ({counts[t.key] || 0})</TabButton>
            ))}
          </div>
        ) : <div />}
        {!archivedView && tab === 'employee' && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm py-2"><Plus className="w-4 h-4" /> Add User</button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <form onSubmit={handleAdd} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-4 fade-up">
            <div className="md:col-span-2 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">New Employee</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <input placeholder="Email" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" />
            <input placeholder="Password" type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input-field" />
            <input placeholder="First Name" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="input-field" />
            <input placeholder="Last Name" required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="input-field" />
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" />
            <Select value={form.position} onChange={position => setForm({ ...form, position })} options={POSITION_OPTIONS} />
            <button type="submit" className="btn-primary md:col-span-2">Save User</button>
          </form>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
              {tab !== 'customer' && <th className="p-3 font-medium">Code</th>}
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Phone</th>
              <th className="p-3 font-medium">Address</th>
              {!archivedView && tab === 'employee' && <th className="p-3 font-medium">Position</th>}
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">No {archivedView ? 'archived ' : ''}{tab}s found.</td></tr>
            ) : filtered.map(u => {
              const isRevealed = revealed.has(u.id);
              return (
                <tr key={u.id} className="border-t border-gray-100">
                  {tab !== 'customer' && <td className="p-3 font-mono text-xs text-gray-500">{u.staff_code || '—'}</td>}
                  <td className="p-3 font-medium text-gray-800">{u.first_name} {u.last_name}</td>
                  <td className="p-3 text-gray-600">{u.email}</td>
                  <td className="p-3 text-gray-600 font-mono text-xs">{isRevealed ? (u.phone || '—') : maskPhone(u.phone)}</td>
                  <td className="p-3 text-gray-600">{isRevealed ? (u.address || '—') : maskAddress(u.address)}</td>
                  {!archivedView && tab === 'employee' && (
                    <td className="p-3">
                      {promotingId === u.id ? (
                        <Select
                          defaultOpen
                          value={u.position || ''}
                          onChange={position => promote(u.id, position)}
                          onClose={() => setPromotingId(null)}
                          placeholder="Choose position"
                          options={POSITION_OPTIONS}
                          className="w-48"
                        />
                      ) : (
                        <button
                          onClick={() => setPromotingId(u.id)}
                          className={`badge transition hover:opacity-80 ${u.position ? POSITION_COLORS[u.position] : 'bg-white text-gray-400 border border-dashed border-gray-300'}`}
                        >
                          {u.position ? POSITION_LABELS[u.position] || u.position : 'Set position...'}
                        </button>
                      )}
                    </td>
                  )}
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => toggleReveal(u.id)} title={isRevealed ? 'Hide details' : 'Reveal details'} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition">
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      {!archivedView && tab === 'customer' && (
                        promotingId === u.id ? (
                          <Select
                            defaultOpen
                            value=""
                            onChange={position => position && promote(u.id, position)}
                            onClose={() => setPromotingId(null)}
                            placeholder="Promote to..."
                            options={POSITION_OPTIONS}
                            className="w-48"
                          />
                        ) : (
                          <button onClick={() => setPromotingId(u.id)} title="Promote to employee" className="p-1.5 rounded-lg bg-teal-50 text-[#00806f] hover:bg-teal-100 transition">
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                      {archivedView ? (
                        <>
                          <button onClick={() => restoreUser(u.id)} title="Restore" className="p-1.5 rounded-lg bg-teal-50 text-[#00806f] hover:bg-teal-100 transition"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteForever(u.id)} title="Delete permanently" className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        u.role !== 'admin' && (
                          <button onClick={() => archiveUser(u.id)} title="Archive" className="p-1.5 rounded-lg bg-orange-50 text-brand-orange hover:bg-orange-100 transition"><Archive className="w-3.5 h-3.5" /></button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
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
