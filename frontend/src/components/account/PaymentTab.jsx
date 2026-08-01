import { useEffect, useState } from 'react';
import { CreditCard, Plus, Star, Trash2, X, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client';
import Select from '../Select';

const emptyForm = { cardNumber: '', expMonth: '', expYear: '' };

export default function PaymentTab() {
  const [methods, setMethods] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get('/payment-methods/my').then(setMethods).catch(() => setMethods([]));
  useEffect(() => { load(); }, []);

  const startAdd = () => { setForm(emptyForm); setShowForm(true); setError(''); };
  const cancel = () => { setShowForm(false); setForm(emptyForm); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.expMonth || !form.expYear) { setError('Please select an expiry month and year.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/payment-methods', form);
      await load();
      cancel();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Remove this payment method?')) return;
    await api.delete(`/payment-methods/${id}`);
    load();
  };

  const setDefault = async (id) => {
    await api.put(`/payment-methods/${id}/default`);
    load();
  };

  const yearOptions = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() + i);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-semibold text-lg text-brand-navy">Payment Methods</h2>
        {!showForm && (
          <button onClick={startAdd} className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy hover:text-brand-orange transition">
            <Plus className="w-4 h-4" /> Add Card
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 mb-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">New Card</h3>
            <button type="button" onClick={cancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700">Card Number</label>
            <input value={form.cardNumber} onChange={e => setForm({ ...form, cardNumber: e.target.value })} placeholder="1234 5678 9012 3456" className="input-field" required inputMode="numeric" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">Expiry Month</label>
              <Select
                value={form.expMonth}
                onChange={expMonth => setForm({ ...form, expMonth })}
                placeholder="Month"
                options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1).padStart(2, '0') }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">Expiry Year</label>
              <Select
                value={form.expYear}
                onChange={expYear => setForm({ ...form, expYear })}
                placeholder="Year"
                options={yearOptions.map(y => ({ value: String(y), label: String(y) }))}
              />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00806f]" /> We only store your card's brand and last 4 digits — the full number is never saved.
          </p>
          <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-60">{saving ? 'Saving...' : 'Save Card'}</button>
        </form>
      )}

      {methods === null ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : methods.length === 0 && !showForm ? (
        <div className="text-center py-10">
          <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No saved payment methods yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 border border-gray-100">
                <CreditCard className="w-4 h-4 text-brand-navy" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-800">{m.brand} •••• {m.last4}</p>
                  {!!m.is_default && <span className="badge bg-brand-teal/15 text-[#00806f] flex items-center gap-1"><Star className="w-3 h-3" /> Default</span>}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Expires {String(m.exp_month).padStart(2, '0')}/{m.exp_year}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!m.is_default && (
                  <button onClick={() => setDefault(m.id)} title="Set as default" className="p-2 text-gray-400 hover:text-brand-orange transition"><Star className="w-4 h-4" /></button>
                )}
                <button onClick={() => remove(m.id)} title="Remove" className="p-2 text-gray-400 hover:text-red-600 transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
