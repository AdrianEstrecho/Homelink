import { useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

const FIELDS = [
  'currency_code', 'currency_symbol', 'tax_rate',
  'shipping_fee', 'free_shipping_threshold', 'delivery_estimate',
  'payment_card_enabled', 'payment_gcash_enabled', 'payment_qrph_enabled',
];

export default function AdminSettings() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { api.get('/admin/settings').then(setForm).catch(() => {}); }, []);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const toggle = (key) => setForm(f => ({ ...f, [key]: f[key] === 'true' ? 'false' : 'true' }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = Object.fromEntries(FIELDS.map(k => [k, form[k]]));
      await api.put('/admin/settings', payload);
      setNotice('Settings saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <AdminLayout title="Platform Settings">
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Platform Settings" subtitle="Currency, shipping, and payment configuration shown across the admin panel.">
      <form onSubmit={handleSave} className="max-w-3xl space-y-6">
        {notice && <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</p>}
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-1">General</h3>
          <p className="text-xs text-gray-400 mb-4">Currency and tax used for display across the storefront and admin panel.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 mb-1 block">Currency Code</span>
              <input value={form.currency_code} onChange={e => set('currency_code', e.target.value)} className="input-field" placeholder="PHP" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 mb-1 block">Currency Symbol</span>
              <input value={form.currency_symbol} onChange={e => set('currency_symbol', e.target.value)} className="input-field" placeholder="₱" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 mb-1 block">Tax Rate (%)</span>
              <input type="number" step="0.01" min="0" value={form.tax_rate} onChange={e => set('tax_rate', e.target.value)} className="input-field" />
            </label>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Shipping</h3>
          <p className="text-xs text-gray-400 mb-4">Shipping fee and delivery estimate shown to customers.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 mb-1 block">Flat Shipping Fee</span>
              <input type="number" step="0.01" min="0" value={form.shipping_fee} onChange={e => set('shipping_fee', e.target.value)} className="input-field" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 mb-1 block">Free Shipping Threshold</span>
              <input type="number" step="0.01" min="0" value={form.free_shipping_threshold} onChange={e => set('free_shipping_threshold', e.target.value)} className="input-field" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 mb-1 block">Delivery Estimate</span>
              <input value={form.delivery_estimate} onChange={e => set('delivery_estimate', e.target.value)} className="input-field" placeholder="3-5 business days" />
            </label>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Payment Options</h3>
          <p className="text-xs text-gray-400 mb-4">Which payment methods are considered active.</p>
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Informational only for now — toggling a method here doesn't yet change what's offered at checkout.</span>
          </div>
          <div className="space-y-2">
            {[
              ['payment_card_enabled', 'Credit / Debit Card'],
              ['payment_gcash_enabled', 'GCash'],
              ['payment_qrph_enabled', 'QR Ph'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2.5 text-sm text-gray-700">
                <input type="checkbox" checked={form[key] === 'true'} onChange={() => toggle(key)} className="w-4 h-4 rounded accent-brand-orange" />
                {label}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-60">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </AdminLayout>
  );
}
