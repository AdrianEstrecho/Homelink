import { useEffect, useState } from 'react';
import { Plus, Trash2, X, Ticket } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import Select from '../../components/Select';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';

const emptyForm = { code: '', discountType: 'percent', discountValue: '', minOrder: '', maxUses: '100', validFrom: '', validUntil: '' };
const DISCOUNT_TYPE_OPTIONS = [{ value: 'percent', label: 'Percent Off' }, { value: 'fixed', label: 'Fixed Amount Off' }];

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { dateStyle: 'medium' });
}

function requestLabel(r, vouchers) {
  if (r.payload?.code) return r.payload.code;
  return vouchers.find(v => v.id === r.entity_id)?.code || 'this voucher';
}

export default function AdminVouchers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isGeneralStaff = user?.position === 'general_staff';
  const [vouchers, setVouchers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pageError, setPageError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmToggleId, setConfirmToggleId] = useState(null);
  const [myRequests, setMyRequests] = useState([]);

  const load = () => api.get('/admin/vouchers').then(setVouchers).catch(() => {});
  const loadMyRequests = () => {
    if (!isGeneralStaff) return;
    api.get('/admin/approvals/mine').then(rows => setMyRequests(rows.filter(r => r.entity_type === 'voucher' && r.status === 'pending'))).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  useEffect(loadMyRequests, [isGeneralStaff]);

  const cancelForm = () => { setShowForm(false); setForm(emptyForm); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const result = await api.post('/admin/vouchers', {
        code: form.code, discountType: form.discountType, discountValue: Number(form.discountValue),
        minOrder: Number(form.minOrder) || 0, maxUses: Number(form.maxUses) || 100,
        validFrom: form.validFrom || null, validUntil: form.validUntil || null,
      });
      cancelForm();
      if (result?.pending) setNotice(result.message || 'Submitted for clerk approval.');
      load();
      loadMyRequests();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleActive = async (id) => { await api.put(`/admin/vouchers/${id}/toggle`); load(); };
  const confirmToggle = () => { toggleActive(confirmToggleId); setConfirmToggleId(null); };
  const toggleTarget = vouchers.find(v => v.id === confirmToggleId);

  const remove = async (id) => {
    try {
      const result = await api.delete(`/admin/vouchers/${id}`);
      if (result?.pending) setNotice(result.message || 'Deletion request submitted for clerk approval.');
      else setNotice('');
      load();
      loadMyRequests();
    } catch (err) {
      setPageError(err.message);
    }
  };
  const confirmDelete = () => { setNotice(''); setPageError(''); remove(confirmDeleteId); setConfirmDeleteId(null); };

  return (
    <AdminLayout title="Voucher Management" subtitle="Create and manage discount vouchers for customers.">
      <ConfirmDialog
        open={!!confirmDeleteId}
        icon={Trash2}
        tone="delete"
        title={isAdmin ? 'Delete this voucher?' : 'Request deletion of this voucher?'}
        message={isAdmin ? 'This cannot be undone.' : 'An inventory clerk will need to approve this before the voucher is removed.'}
        confirmLabel={isAdmin ? 'Delete' : 'Request Deletion'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <ConfirmDialog
        open={!!confirmToggleId}
        icon={Ticket}
        tone="update"
        title={toggleTarget ? `${toggleTarget.active ? 'Deactivate' : 'Activate'} this voucher?` : ''}
        message={toggleTarget?.active ? 'Customers will no longer be able to use this code.' : 'Customers will be able to use this code again.'}
        confirmLabel={toggleTarget?.active ? 'Deactivate' : 'Activate'}
        onConfirm={confirmToggle}
        onCancel={() => setConfirmToggleId(null)}
      />

      {notice && <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</p>}
      {pageError && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{pageError}</p>}

      {isGeneralStaff && myRequests.length > 0 && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Pending Requests</h3>
          <div className="space-y-1.5">
            {myRequests.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600"><span className="capitalize font-medium">{r.action}</span> — {requestLabel(r, vouchers)}</span>
                <span className="badge bg-amber-100 text-amber-800">Pending clerk review</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end mb-4">
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm py-2"><Plus className="w-4 h-4" /> Add Voucher</button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={cancelForm} />
          <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-4 fade-up">
            <div className="md:col-span-2 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">New Voucher</h3>
              <button type="button" onClick={cancelForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            {error && <p className="md:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

            <input placeholder="Code (e.g. SAVE20)" required value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input-field md:col-span-2 font-mono" />
            <Select value={form.discountType} onChange={discountType => setForm({ ...form, discountType })} options={DISCOUNT_TYPE_OPTIONS} />
            <input placeholder={form.discountType === 'percent' ? 'Discount %' : 'Discount ₱'} type="number" min="0" required value={form.discountValue} onChange={e => setForm({ ...form, discountValue: e.target.value })} className="input-field" />
            <input placeholder="Minimum Order (₱)" type="number" min="0" value={form.minOrder} onChange={e => setForm({ ...form, minOrder: e.target.value })} className="input-field" />
            <input placeholder="Max Uses" type="number" min="1" value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })} className="input-field" />
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Valid From</label>
              <input type="date" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Valid Until</label>
              <input type="date" value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })} className="input-field" />
            </div>
            {isGeneralStaff && (
              <p className="md:col-span-2 text-xs text-gray-400">This voucher won't go live until an inventory clerk reviews and approves it.</p>
            )}
            <button type="submit" className="btn-primary md:col-span-2">{isGeneralStaff ? 'Submit for Approval' : 'Save Voucher'}</button>
          </form>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">Discount</th>
              <th className="p-3 font-medium">Min Order</th>
              <th className="p-3 font-medium">Uses</th>
              <th className="p-3 font-medium">Valid Period</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">No vouchers yet.</td></tr>
            ) : vouchers.map(v => (
              <tr key={v.id} className="border-t border-gray-100">
                <td className="p-3">
                  <div className="flex items-center gap-2 font-mono font-semibold text-gray-800">
                    <Ticket className="w-3.5 h-3.5 text-brand-orange shrink-0" /> {v.code}
                  </div>
                </td>
                <td className="p-3 text-gray-600">{v.discount_type === 'percent' ? `${v.discount_value}%` : formatPrice(v.discount_value)} off</td>
                <td className="p-3 text-gray-600">{v.min_order > 0 ? formatPrice(v.min_order) : '—'}</td>
                <td className="p-3 text-gray-600">{v.used_count} / {v.max_uses}</td>
                <td className="p-3 text-gray-600 text-xs">{formatDate(v.valid_from)} – {formatDate(v.valid_until)}</td>
                <td className="p-3">
                  <button onClick={() => setConfirmToggleId(v.id)} className={`badge ${v.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {v.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => setConfirmDeleteId(v.id)} title={isAdmin ? 'Delete' : 'Request deletion'} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
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
