import { useEffect, useState } from 'react';
import { MapPin, Plus, Star, Pencil, Trash2, X } from 'lucide-react';
import { api } from '../../api/client';

const emptyForm = { label: '', houseNumber: '', street: '', village: '', city: '', province: '', postalCode: '' };

export default function AddressesTab() {
  const [addresses, setAddresses] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get('/addresses/my').then(setAddresses).catch(() => setAddresses([]));
  useEffect(() => { load(); }, []);

  const startAdd = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); setError(''); };
  const startEdit = (a) => {
    setForm({
      label: a.label, houseNumber: a.house_number || '', street: a.street,
      village: a.village || '', city: a.city, province: a.province, postalCode: a.postal_code,
    });
    setEditingId(a.id);
    setShowForm(true);
    setError('');
  };
  const cancel = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) await api.put(`/addresses/${editingId}`, form);
      else await api.post('/addresses', form);
      await load();
      cancel();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this address?')) return;
    await api.delete(`/addresses/${id}`);
    load();
  };

  const setDefault = async (id) => {
    await api.put(`/addresses/${id}/default`);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-semibold text-lg text-brand-navy">Saved Addresses</h2>
        {!showForm && (
          <button onClick={startAdd} className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy hover:text-brand-orange transition">
            <Plus className="w-4 h-4" /> Add Address
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 mb-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">{editingId ? 'Edit Address' : 'New Address'}</h3>
            <button type="button" onClick={cancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700">Label</label>
            <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Home, Office, ..." className="input-field" required />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">House / Unit No.</label>
              <input value={form.houseNumber} onChange={e => setForm({ ...form, houseNumber: e.target.value })} placeholder="123" className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5 text-gray-700">Street</label>
              <input value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} placeholder="Rizal Street" className="input-field" required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">Village / Barangay</label>
              <input value={form.village} onChange={e => setForm({ ...form, village: e.target.value })} placeholder="Barangay San Isidro" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">City / Municipality</label>
              <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Makati City" className="input-field" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">Province</label>
              <input value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} placeholder="Metro Manila" className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">Postal Code</label>
              <input value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} placeholder="1200" className="input-field" required />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-60">{saving ? 'Saving...' : 'Save Address'}</button>
        </form>
      )}

      {addresses === null ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : addresses.length === 0 && !showForm ? (
        <div className="text-center py-10">
          <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No saved addresses yet. Add one to speed up checkout.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map(a => (
            <div key={a.id} className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 border border-gray-100">
                <MapPin className="w-4 h-4 text-brand-navy" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-800">{a.label}</p>
                  {!!a.is_default && <span className="badge bg-brand-teal/15 text-[#00806f] flex items-center gap-1"><Star className="w-3 h-3" /> Default</span>}
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{[a.house_number, a.street].filter(Boolean).join(' ')}</p>
                <p className="text-sm text-gray-600">{[a.village, a.city].filter(Boolean).join(', ')}</p>
                <p className="text-sm text-gray-600">{[a.province, a.postal_code].filter(Boolean).join(' ')}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!a.is_default && (
                  <button onClick={() => setDefault(a.id)} title="Set as default" className="p-2 text-gray-400 hover:text-brand-orange transition"><Star className="w-4 h-4" /></button>
                )}
                <button onClick={() => startEdit(a)} title="Edit" className="p-2 text-gray-400 hover:text-brand-navy transition"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(a.id)} title="Delete" className="p-2 text-gray-400 hover:text-red-600 transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
