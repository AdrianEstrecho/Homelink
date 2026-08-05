import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, X, Truck } from 'lucide-react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';

const emptyForm = { name: '', contactName: '', email: '', phone: '', address: '', category: '', notes: '' };

function toForm(s) {
  return { name: s.name, contactName: s.contact_name || '', email: s.email || '', phone: s.phone || '', address: s.address || '', category: s.category || '', notes: s.notes || '' };
}

export default function Suppliers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmToggleId, setConfirmToggleId] = useState(null);
  const [myRequests, setMyRequests] = useState([]);

  const load = () => api.get('/admin/suppliers').then(setSuppliers).catch(() => {});
  const loadMyRequests = () => {
    if (isAdmin) return;
    api.get('/admin/approvals/mine').then(rows => setMyRequests(rows.filter(r => r.entity_type === 'supplier' && r.status === 'pending'))).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  useEffect(loadMyRequests, [isAdmin]);

  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); setError(''); };
  const startEdit = (s) => { setEditingId(s.id); setForm(toForm(s)); setError(''); setShowForm(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      const result = editingId
        ? await api.put(`/admin/suppliers/${editingId}`, form)
        : await api.post('/admin/suppliers', form);
      cancelForm();
      if (result?.pending) setNotice(result.message || 'Submitted for admin approval.');
      load();
      loadMyRequests();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleActive = async (id) => { await api.put(`/admin/suppliers/${id}/toggle`); load(); };
  const confirmToggle = () => { toggleActive(confirmToggleId); setConfirmToggleId(null); };
  const toggleTarget = suppliers.find(s => s.id === confirmToggleId);

  const remove = async (id) => {
    setNotice('');
    const result = await api.delete(`/admin/suppliers/${id}`);
    if (result?.pending) setNotice(result.message || 'Deletion request submitted for admin approval.');
    load();
    loadMyRequests();
  };
  const confirmDelete = () => { remove(confirmDeleteId); setConfirmDeleteId(null); };

  return (
    <AdminLayout title="Supplier Management" subtitle="Manage vendors and material suppliers.">
      <ConfirmDialog
        open={!!confirmDeleteId}
        icon={Trash2}
        tone="delete"
        title={isAdmin ? 'Delete this supplier?' : 'Request deletion of this supplier?'}
        message={isAdmin ? 'This cannot be undone.' : 'An admin will need to approve this before the supplier is removed.'}
        confirmLabel={isAdmin ? 'Delete' : 'Request Deletion'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <ConfirmDialog
        open={!!confirmToggleId}
        icon={Truck}
        tone="update"
        title={toggleTarget ? `${toggleTarget.status === 'active' ? 'Deactivate' : 'Activate'} this supplier?` : ''}
        message={toggleTarget?.status === 'active' ? 'This supplier will be marked inactive.' : 'This supplier will be marked active again.'}
        confirmLabel={toggleTarget?.status === 'active' ? 'Deactivate' : 'Activate'}
        onConfirm={confirmToggle}
        onCancel={() => setConfirmToggleId(null)}
      />

      {notice && <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</p>}

      {!isAdmin && myRequests.length > 0 && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Pending Requests</h3>
          <div className="space-y-1.5">
            {myRequests.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600"><span className="capitalize font-medium">{r.action}</span> — {r.payload?.name || suppliers.find(s => s.id === r.entity_id)?.name || 'supplier'}</span>
                <span className="badge bg-amber-100 text-amber-800">Pending admin review</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end mb-4">
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm py-2"><Plus className="w-4 h-4" /> Add Supplier</button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={cancelForm} />
          <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-4 fade-up">
            <div className="md:col-span-2 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">{editingId ? 'Edit Supplier' : 'New Supplier'}</h3>
              <button type="button" onClick={cancelForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            {error && <p className="md:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

            <input placeholder="Supplier Name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field md:col-span-2" />
            <input placeholder="Contact Person" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} className="input-field" />
            <input placeholder="Category (e.g. Electrical)" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-field" />
            <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" />
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" />
            <input placeholder="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input-field md:col-span-2" />
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field md:col-span-2" rows={2} />
            {!isAdmin && (
              <p className="md:col-span-2 text-xs text-gray-400">This {editingId ? 'change' : 'supplier'} won't go live until an admin reviews and approves it.</p>
            )}
            <button type="submit" className="btn-primary md:col-span-2">{isAdmin ? 'Save Supplier' : 'Submit for Approval'}</button>
          </form>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Contact</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">Phone</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">No suppliers yet.</td></tr>
            ) : suppliers.map(s => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="p-3">
                  <div className="flex items-center gap-2 font-medium text-gray-800">
                    <Truck className="w-3.5 h-3.5 text-brand-orange shrink-0" /> {s.name}
                  </div>
                  {s.email && <p className="text-xs text-gray-400 ml-5">{s.email}</p>}
                </td>
                <td className="p-3 text-gray-600">{s.contact_name || '—'}</td>
                <td className="p-3 text-gray-600">{s.category || '—'}</td>
                <td className="p-3 text-gray-600">{s.phone || '—'}</td>
                <td className="p-3">
                  <button onClick={() => setConfirmToggleId(s.id)} className={`badge ${s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {s.status === 'active' ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => startEdit(s)} title="Edit" className="p-1.5 rounded-lg bg-teal-50 text-[#00806f] hover:bg-teal-100 transition"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setConfirmDeleteId(s.id)} title={isAdmin ? 'Delete' : 'Request deletion'} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
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
