import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const PROFILE_ADDRESS_ID = '__profile__';
const emptyAddressForm = { label: '', houseNumber: '', street: '', village: '', city: '', province: '', postalCode: '' };

const AddressPicker = forwardRef(function AddressPicker({ stepNumber = 1, title = 'Address' }, ref) {
  const { user } = useAuth();
  const hasProfileAddress = !!user?.address?.trim();

  const [addresses, setAddresses] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyAddressForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/addresses/my').then(data => {
      setAddresses(data);
      const def = data.find(a => a.is_default) || data[0];
      if (def) setSelectedId(def.id);
      else if (hasProfileAddress) setSelectedId(PROFILE_ADDRESS_ID);
      else setShowForm(true);
    }).catch(() => {
      setAddresses([]);
      if (hasProfileAddress) setSelectedId(PROFILE_ADDRESS_ID); else setShowForm(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = [
    ...(addresses || []),
    ...(hasProfileAddress ? [{ id: PROFILE_ADDRESS_ID, label: 'My Profile Address', fullAddress: user.address.trim(), is_default: false }] : []),
  ];

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const saved = await api.post('/addresses', form);
      setAddresses(prev => [saved, ...(prev || [])]);
      setSelectedId(saved.id);
      setShowForm(false);
      setForm(emptyAddressForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    validate: () => options.find(a => a.id === selectedId) || null,
  }), [options, selectedId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold text-brand-ink">
          <span className="w-6 h-6 rounded-full bg-brand-navy text-white text-xs font-bold flex items-center justify-center shrink-0">{stepNumber}</span>
          {title}
        </h2>
        {!showForm && options.length > 0 && (
          <button type="button" onClick={() => { setShowForm(true); setError(''); }} className="flex items-center gap-1 text-sm font-semibold text-brand-teal hover:underline">
            <Plus className="w-3.5 h-3.5" /> Add New
          </button>
        )}
      </div>

      {addresses === null ? (
        <p className="text-sm text-gray-400">Loading addresses...</p>
      ) : options.length > 0 ? (
        <div className="space-y-3">
          {options.map(a => (
            <label key={a.id} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${selectedId === a.id ? 'border-brand-orange bg-brand-orange/5' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="address" checked={selectedId === a.id} onChange={() => setSelectedId(a.id)} className="mt-1 accent-brand-orange" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-brand-ink">{a.label}</p>
                  {!!a.is_default && <span className="badge bg-brand-teal/15 text-brand-teal">Default</span>}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{a.fullAddress}</p>
              </div>
            </label>
          ))}
        </div>
      ) : null}

      {showForm && (
        <div className={`p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-4 ${options.length > 0 ? 'mt-4' : ''}`}>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700">Label</label>
            <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Home, Office, ..." className="input-field" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">House / Unit No.</label>
              <input value={form.houseNumber} onChange={e => setForm({ ...form, houseNumber: e.target.value })} placeholder="123" className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5 text-gray-700">Street</label>
              <input value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} placeholder="Rizal Street" className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">Village / Barangay</label>
              <input value={form.village} onChange={e => setForm({ ...form, village: e.target.value })} placeholder="Barangay San Isidro" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">City / Municipality</label>
              <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Makati City" className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">Province</label>
              <input value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} placeholder="Metro Manila" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">Postal Code</label>
              <input value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} placeholder="1200" className="input-field" />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save & Use This Address'}
            </button>
            {options.length > 0 && (
              <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default AddressPicker;
