import { useEffect, useState } from 'react';
import { Save, Wallet, Send, Truck, X, Landmark } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { POSITION_LABELS } from '../../data/auditActions';

function maskAccount(number) {
  if (!number) return null;
  return `••••${number.slice(-4)}`;
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

export default function Payroll() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('employees');

  const [employees, setEmployees] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [suppliers, setSuppliers] = useState(null);

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [myRequests, setMyRequests] = useState([]);

  const [payForm, setPayForm] = useState(null); // { type, id, name, amount, bankName, accountNumber, accountName }
  const [confirmPay, setConfirmPay] = useState(false);

  const loadEmployees = () => api.get('/admin/payroll').then(rows => {
    setEmployees(rows);
    setDrafts(Object.fromEntries(rows.map(r => [r.id, String(r.salary ?? 0)])));
  }).catch(() => {});
  const loadSuppliers = () => api.get('/admin/suppliers').then(setSuppliers).catch(() => {});
  useEffect(() => { loadEmployees(); loadSuppliers(); }, []);

  const loadMyRequests = () => {
    if (isAdmin) return;
    api.get('/admin/approvals/mine').then(rows => setMyRequests(rows.filter(r => ['salary', 'payment'].includes(r.entity_type) && r.status === 'pending'))).catch(() => {});
  };
  useEffect(loadMyRequests, [isAdmin]);

  const totalPayroll = (employees || []).reduce((sum, e) => sum + Number(e.salary || 0), 0);

  const isDirty = (e) => drafts[e.id] !== undefined && Number(drafts[e.id]) !== Number(e.salary || 0);
  const dirtyRows = (employees || []).filter(isDirty);

  const saveAll = async () => {
    setSaving(true);
    setNotice('');
    try {
      const changes = dirtyRows.map(e => ({ id: e.id, salary: Number(drafts[e.id]) || 0 }));
      const result = await api.put('/admin/payroll/salaries', { changes });
      setNotice(result?.pending ? (result.message || 'Submitted for admin approval.') : `Updated ${changes.length} salar${changes.length === 1 ? 'y' : 'ies'}.`);
      loadEmployees();
      loadMyRequests();
    } finally {
      setSaving(false);
    }
  };
  const confirmSave = () => { setConfirmOpen(false); saveAll(); };
  const confirmMessage = dirtyRows
    .map(e => `${e.first_name} ${e.last_name}: ${formatPrice(e.salary || 0)} → ${formatPrice(Number(drafts[e.id]) || 0)}`)
    .join('\n') + (isAdmin ? '' : '\n\nAn admin will need to approve these before they take effect.');

  const openPay = (type, entity) => {
    setNotice('');
    setError('');
    if (type === 'employee') {
      setPayForm({
        type, id: entity.id, name: `${entity.first_name} ${entity.last_name}`,
        amount: String(entity.salary || ''), bankName: entity.bank_name || '',
        accountNumber: entity.bank_account_number || '', accountName: entity.bank_account_name || `${entity.first_name} ${entity.last_name}`,
      });
    } else {
      setPayForm({
        type, id: entity.id, name: entity.name,
        amount: '', bankName: entity.bank_name || '',
        accountNumber: entity.bank_account_number || '', accountName: entity.bank_account_name || entity.name,
      });
    }
  };

  const submitPayForm = (e) => {
    e.preventDefault();
    setConfirmPay(true);
  };

  const confirmPaySubmit = async () => {
    setError('');
    try {
      const result = await api.post('/admin/payroll/pay', {
        recipientType: payForm.type,
        recipientId: payForm.id,
        amount: Number(payForm.amount) || 0,
        bankName: payForm.bankName.trim(),
        accountNumber: payForm.accountNumber.trim(),
        accountName: payForm.accountName.trim(),
      });
      setNotice(result?.pending ? (result.message || 'Submitted for admin approval.') : 'Payment recorded.');
      setConfirmPay(false);
      setPayForm(null);
      loadEmployees();
      loadSuppliers();
      loadMyRequests();
    } catch (err) {
      setConfirmPay(false);
      setError(err.message);
    }
  };

  return (
    <AdminLayout title="Payroll" subtitle="Set base salaries, pay employees and suppliers, and review payroll cost.">
      <ConfirmDialog
        open={confirmOpen}
        icon={Wallet}
        tone="update"
        title={isAdmin
          ? `Save ${dirtyRows.length} salary change${dirtyRows.length === 1 ? '' : 's'}?`
          : `Submit ${dirtyRows.length} salary change${dirtyRows.length === 1 ? '' : 's'} for approval?`}
        message={confirmMessage}
        confirmLabel={isAdmin ? 'Save All' : 'Submit All'}
        onConfirm={confirmSave}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        open={confirmPay}
        icon={Send}
        tone="update"
        title={isAdmin ? 'Send this payment?' : 'Submit this payment for approval?'}
        message={payForm ? `Pay ${payForm.name} ${formatPrice(Number(payForm.amount) || 0)} to ${payForm.bankName} ${maskAccount(payForm.accountNumber) || ''}.${isAdmin ? '' : '\n\nAn admin will need to approve this before it is sent.'}` : ''}
        confirmLabel={isAdmin ? 'Pay' : 'Submit'}
        onConfirm={confirmPaySubmit}
        onCancel={() => setConfirmPay(false)}
        zIndexClass="z-[110]"
      />

      {notice && <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</p>}
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      {!isAdmin && myRequests.length > 0 && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Pending Requests</h3>
          <div className="space-y-1.5">
            {myRequests.map(r => (
              <div key={r.id} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">
                    {r.entity_type === 'salary' ? `Salary changes (${r.payload?.changes?.length || 0} employees)` : `Payment to ${r.payload?.recipientName || 'recipient'}`}
                  </span>
                  <span className="badge bg-amber-100 text-amber-800">Pending admin review</span>
                </div>
                <p className="text-gray-500 mt-0.5">
                  {r.entity_type === 'salary'
                    ? (r.payload?.changes || []).map(c => `${c.employeeName}: ${formatPrice(c.fromSalary || 0)} → ${formatPrice(c.salary || 0)}`).join(', ')
                    : `${formatPrice(r.payload?.amount || 0)} to ${r.payload?.bankName} ${maskAccount(r.payload?.accountNumber) || ''}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <TabButton active={tab === 'employees'} onClick={() => setTab('employees')}>Employees</TabButton>
        <TabButton active={tab === 'suppliers'} onClick={() => setTab('suppliers')}>Suppliers</TabButton>
      </div>

      {tab === 'employees' && (
        <>
          <div className="card p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-gray-500">Total monthly payroll ({(employees || []).length} employees)</p>
            <div className="flex items-center gap-3">
              <p className="text-xl font-bold text-brand-navy">{formatPrice(totalPayroll)}</p>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={dirtyRows.length === 0 || saving}
                className={`flex items-center gap-2 text-sm py-2 px-4 rounded-lg font-semibold transition ${dirtyRows.length > 0 ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
              >
                <Save className="w-4 h-4" />
                {isAdmin ? 'Save All Changes' : 'Submit All Changes'}
                {dirtyRows.length > 0 && ` (${dirtyRows.length})`}
              </button>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="p-3 font-medium">Code</th>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Position</th>
                  <th className="p-3 font-medium">Email</th>
                  <th className="p-3 font-medium">Base Salary (₱)</th>
                  <th className="p-3 font-medium">Bank Account</th>
                  <th className="p-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees === null ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">Loading...</td></tr>
                ) : employees.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">No employees found.</td></tr>
                ) : employees.map(e => {
                  const dirty = isDirty(e);
                  return (
                    <tr key={e.id} className="border-t border-gray-100">
                      <td className="p-3 font-mono text-xs text-gray-500">{e.staff_code || '—'}</td>
                      <td className="p-3 font-medium text-gray-800">{e.first_name} {e.last_name}</td>
                      <td className="p-3">
                        <span className="badge bg-gray-100 text-gray-700">{e.position ? POSITION_LABELS[e.position] || e.position : 'No position'}</span>
                      </td>
                      <td className="p-3 text-gray-600">{e.email}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          value={drafts[e.id] ?? ''}
                          onChange={ev => setDrafts({ ...drafts, [e.id]: ev.target.value })}
                          className={`input-field w-32 py-1.5 ${dirty ? 'ring-2 ring-amber-400 border-transparent' : ''}`}
                        />
                      </td>
                      <td className="p-3 text-gray-600 text-xs">
                        {e.bank_account_number ? `${e.bank_name} ${maskAccount(e.bank_account_number)}` : <span className="text-gray-300">Not set</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => openPay('employee', e)}
                            title={isAdmin ? 'Pay employee' : 'Submit payment for approval'}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-[#00806f] hover:bg-teal-100 transition"
                          >
                            <Send className="w-3.5 h-3.5" /> Pay
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'suppliers' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Contact</th>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 font-medium">Bank Account</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers === null ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading...</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">No suppliers yet.</td></tr>
              ) : suppliers.map(s => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="p-3">
                    <div className="flex items-center gap-2 font-medium text-gray-800">
                      <Truck className="w-3.5 h-3.5 text-brand-orange shrink-0" /> {s.name}
                    </div>
                  </td>
                  <td className="p-3 text-gray-600">{s.contact_name || '—'}</td>
                  <td className="p-3 text-gray-600">{s.category || '—'}</td>
                  <td className="p-3 text-gray-600 text-xs">
                    {s.bank_account_number ? `${s.bank_name} ${maskAccount(s.bank_account_number)}` : <span className="text-gray-300">Not set</span>}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => openPay('supplier', s)}
                        title={isAdmin ? 'Pay supplier' : 'Submit payment for approval'}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-[#00806f] hover:bg-teal-100 transition"
                      >
                        <Send className="w-3.5 h-3.5" /> Pay
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={() => setPayForm(null)} />
          <form onSubmit={submitPayForm} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-4 fade-up">
            <div className="md:col-span-2 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Pay {payForm.name}</h3>
              <button type="button" onClick={() => setPayForm(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <label className="md:col-span-2 text-xs font-medium text-gray-500">
              Amount (₱)
              <input type="number" min="0" required value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} className="input-field mt-1" />
            </label>
            <label className="md:col-span-2 text-xs font-medium text-gray-500">
              Bank Name
              <input required value={payForm.bankName} onChange={e => setPayForm({ ...payForm, bankName: e.target.value })} className="input-field mt-1" placeholder="e.g. BDO, BPI" />
            </label>
            <label className="text-xs font-medium text-gray-500">
              Account Number
              <input required value={payForm.accountNumber} onChange={e => setPayForm({ ...payForm, accountNumber: e.target.value })} className="input-field mt-1" />
            </label>
            <label className="text-xs font-medium text-gray-500">
              Account Holder Name
              <input required value={payForm.accountName} onChange={e => setPayForm({ ...payForm, accountName: e.target.value })} className="input-field mt-1" />
            </label>
            {!isAdmin && (
              <p className="md:col-span-2 text-xs text-gray-400">This payment won't be sent until an admin reviews and approves it.</p>
            )}
            <button type="submit" className="btn-primary md:col-span-2 flex items-center justify-center gap-2">
              <Landmark className="w-4 h-4" /> {isAdmin ? 'Continue to Pay' : 'Continue to Submit'}
            </button>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}
