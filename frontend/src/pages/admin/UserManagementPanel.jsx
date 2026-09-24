import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, ArrowUpCircle, X, Archive, ArchiveRestore } from 'lucide-react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import Select from '../../components/Select';
import ConfirmDialog from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import { useAuth } from '../../context/AuthContext';
import { DEPARTMENT_LABELS } from '../../data/auditActions';

const DEPARTMENT_COLORS = {
  booking_coordinator: 'bg-blue-100 text-blue-800',
  hr: 'bg-pink-100 text-pink-800',
  installer: 'bg-orange-100 text-orange-800',
  inventory_clerk: 'bg-teal-100 text-teal-800',
  general_staff: 'bg-gray-100 text-gray-700',
};

const DEPARTMENT_OPTIONS = Object.entries(DEPARTMENT_LABELS).map(([value, label]) => ({ value, label }));

const UNSET_BADGE = 'bg-white text-gray-400 border border-dashed border-gray-300';

// Ten rows a page, matching the product and service lists so every admin table pages alike.
const PAGE_SIZE = 10;

const REQUEST_ACTION_LABELS = { create: 'Onboard', update: 'Change Department', archive: 'Archive', restore: 'Restore', delete: 'Delete' };

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

// Shared by Users.jsx (customers), AdminManagement.jsx (admins), and EmployeeManagement.jsx
// (HR's employee-only slice) — the role tabs decide which slice of the same /admin/users
// list each page shows, and the Active/Archived toggle below lives inside this same panel
// (rather than a separate nav page) so admins don't need to leave the page to find
// archived accounts. On the Admins tab only an admin sees the toggle, and can archive any
// other admin (never themselves — the backend also keeps at least one admin active); an
// archived admin can then be restored or permanently deleted from the Archived view.
// HR sees the same write actions as admin (add, promote, archive, restore, delete), but
// every one of HR's writes is only *proposed*: the backend queues it as a change request
// for admin to approve rather than applying it immediately (see api responses' `pending`
// flag below). General staff can reach this panel too (view-only, canManage is false).
export default function UserManagementPanel({ roleTabs, title, subtitle }) {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isHR = currentUser?.position === 'hr';
  // HR onboards/manages employee accounts alongside admin, but never touches the Admins
  // tab, archived users, or permanent delete — those stay admin-only below.
  const canManage = isAdmin || isHR;
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState(roleTabs[0].key);
  const [view, setView] = useState('active');
  const archivedView = view === 'archived';
  const canToggleArchive = tab !== 'admin' || isAdmin;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', position: 'general_staff' });
  const [revealed, setRevealed] = useState(new Set());
  const [promotingId, setPromotingId] = useState(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [formError, setFormError] = useState('');
  const [myRequests, setMyRequests] = useState([]);
  const [page, setPage] = useState(1);

  const load = () => api.get('/admin/users').then(setUsers).catch(() => {});
  useEffect(() => { load(); }, []);

  const loadMyRequests = () => {
    if (!isHR) return;
    api.get('/admin/approvals/mine').then(rows => setMyRequests(rows.filter(r => r.entity_type === 'employee' && r.status === 'pending'))).catch(() => {});
  };
  useEffect(loadMyRequests, [isHR]);

  const counts = useMemo(() => {
    const c = {};
    roleTabs.forEach(t => { c[t.key] = users.filter(u => u.role === t.key && !!u.archived === archivedView).length; });
    return c;
  }, [users, roleTabs, archivedView]);

  const filtered = users.filter(u => u.role === tab && !!u.archived === archivedView);

  useEffect(() => { setPage(1); }, [tab, view]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamped rather than reset by an effect: archiving or restoring from this very table moves a
  // row into the other view and can shrink the list past the page being read, and the nearest
  // page that still exists beats being thrown back to the first one.
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeCountForTab = users.filter(u => u.role === tab && !u.archived).length;
  const archivedCountForTab = users.filter(u => u.role === tab && !!u.archived).length;

  const toggleReveal = (id) => {
    setRevealed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const closeForm = () => { setShowForm(false); setFormError(''); };

  const handleAdd = async (e) => {
    e.preventDefault();
    setNotice('');
    setFormError('');
    const role = tab === 'admin' ? 'admin' : 'employee';
    let result;
    try {
      result = await api.post('/admin/users', { ...form, role });
    } catch (err) {
      setFormError(err.message || 'Could not add user.');
      return;
    }
    closeForm();
    setForm({ email: '', password: '', firstName: '', lastName: '', phone: '', position: 'general_staff' });
    if (result?.pending) setNotice(result.message || 'Submitted for admin approval.');
    load();
    loadMyRequests();
  };

  // Every row action goes through here so a refusal from the backend (e.g. archiving the last
  // active admin, or deleting an account other records still depend on) is shown instead of
  // failing silently.
  const runAction = async (request, pendingMessage) => {
    setNotice('');
    setActionError('');
    try {
      const result = await request();
      if (result?.pending) setNotice(result.message || pendingMessage);
    } catch (err) {
      setActionError(err.message || 'Something went wrong. Please try again.');
    }
    load();
    loadMyRequests();
  };
  const archiveUser = (id) => runAction(() => api.put(`/admin/users/${id}/archive`), 'Submitted for admin approval.');
  const restoreUser = (id) => runAction(() => api.put(`/admin/users/${id}/restore`), 'Submitted for admin approval.');
  const deleteForever = (id) => runAction(() => api.delete(`/admin/users/${id}`), 'Deletion request submitted for admin approval.');

  const confirmArchive = () => { archiveUser(confirmArchiveId); setConfirmArchiveId(null); };
  const confirmDelete = () => { deleteForever(confirmDeleteId); setConfirmDeleteId(null); };

  const promote = async (id, position) => {
    setPromotingId(null);
    await runAction(() => api.put(`/admin/users/${id}/promote`, { position }), 'Submitted for admin approval.');
  };

  const archiveTarget = users.find(u => u.id === confirmArchiveId);
  const deleteTarget = users.find(u => u.id === confirmDeleteId);
  const archiveMessage = !isAdmin
    ? 'An admin will need to approve this before the account is archived.'
    : archiveTarget?.role === 'customer'
      ? 'They will no longer be able to sign in, but their data is kept and can be restored later.'
      : "They'll be signed out right away and can't sign in again until restored. Their data is kept.";
  const deleteMessage = !isAdmin
    ? 'An admin will need to approve this before the account is permanently deleted.'
    : deleteTarget?.role === 'customer'
      ? 'This cannot be undone.'
      : 'This cannot be undone. Their notifications and direct messages are deleted too; approvals they reviewed are kept.';

  return (
    <AdminLayout title={title} subtitle={subtitle}>
      <ConfirmDialog
        open={!!confirmArchiveId}
        icon={Archive}
        tone="archive"
        title={isAdmin ? (archiveTarget?.role === 'admin' ? 'Archive this administrator?' : 'Archive this user?') : 'Request to archive this user?'}
        message={archiveMessage}
        confirmLabel={isAdmin ? 'Archive' : 'Request Archive'}
        onConfirm={confirmArchive}
        onCancel={() => setConfirmArchiveId(null)}
      />
      <ConfirmDialog
        open={!!confirmDeleteId}
        icon={Trash2}
        tone="delete"
        title={isAdmin ? (deleteTarget?.role === 'admin' ? 'Permanently delete this administrator?' : 'Permanently delete this user?') : 'Request permanent deletion?'}
        message={deleteMessage}
        confirmLabel={isAdmin ? 'Delete' : 'Request Deletion'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {notice && <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</p>}
      {actionError && <p role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{actionError}</p>}

      {isHR && myRequests.length > 0 && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Pending Requests</h3>
          <div className="space-y-1.5">
            {myRequests.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  <span className="font-medium">{REQUEST_ACTION_LABELS[r.action] || r.action}</span> — {r.payload?.email || users.find(u => u.id === r.entity_id)?.email || 'employee'}
                </span>
                <span className="badge bg-amber-100 text-amber-800">Pending admin review</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {roleTabs.length > 1 && roleTabs.map(t => (
            <TabButton key={t.key} active={tab === t.key} onClick={() => { setTab(t.key); setView('active'); }}>{t.label} ({counts[t.key] || 0})</TabButton>
          ))}
          {canToggleArchive && (
            <>
              <TabButton active={!archivedView} onClick={() => setView('active')}>All Active ({activeCountForTab})</TabButton>
              <TabButton active={archivedView} onClick={() => setView('archived')}>Archived ({archivedCountForTab})</TabButton>
            </>
          )}
        </div>
        {!archivedView && ((canManage && tab === 'employee') || (isAdmin && tab === 'admin')) && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm py-2"><Plus className="w-4 h-4" /> {tab === 'admin' ? 'Add Admin' : 'Add User'}</button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={closeForm} />
          <form onSubmit={handleAdd} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-4 fade-up">
            <div className="md:col-span-2 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">{tab === 'admin' ? 'New Admin' : 'New Employee'}</h3>
              <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <input placeholder="Email" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" />
            <input placeholder="Password" type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input-field" />
            <input placeholder="First Name" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="input-field" />
            <input placeholder="Last Name" required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="input-field" />
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" />
            {tab !== 'admin' && <Select value={form.position} onChange={position => setForm({ ...form, position })} placeholder="Department" options={DEPARTMENT_OPTIONS} />}
            {isHR && tab === 'employee' && (
              <p className="md:col-span-2 text-xs text-gray-400">This account won't be created until an admin reviews and approves it.</p>
            )}
            {formError && <p className="md:col-span-2 text-sm text-red-600">{formError}</p>}
            <button type="submit" className="btn-primary md:col-span-2">{tab === 'admin' ? 'Save Admin' : isHR ? 'Submit for Approval' : 'Save User'}</button>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
              {tab !== 'customer' && <th className="p-3 font-medium">Code</th>}
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Phone</th>
              <th className="p-3 font-medium">Address</th>
              {!archivedView && tab === 'employee' && <th className="p-3 font-medium">Department</th>}
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">No {archivedView ? 'archived ' : ''}{tab}s found.</td></tr>
            ) : paginated.map(u => {
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
                      {canManage && promotingId === u.id ? (
                        <Select
                          defaultOpen
                          value={u.position || ''}
                          onChange={position => promote(u.id, position)}
                          onClose={() => setPromotingId(null)}
                          placeholder="Choose department"
                          options={DEPARTMENT_OPTIONS}
                          className="w-48"
                        />
                      ) : canManage ? (
                        <button
                          onClick={() => setPromotingId(u.id)}
                          className={`badge transition hover:opacity-80 ${u.position ? DEPARTMENT_COLORS[u.position] || DEPARTMENT_COLORS.general_staff : UNSET_BADGE}`}
                        >
                          {u.position ? DEPARTMENT_LABELS[u.position] || u.position : 'Set department...'}
                        </button>
                      ) : (
                        <span className={`badge ${u.position ? DEPARTMENT_COLORS[u.position] || DEPARTMENT_COLORS.general_staff : UNSET_BADGE}`}>
                          {u.position ? DEPARTMENT_LABELS[u.position] || u.position : 'No department'}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => toggleReveal(u.id)} title={isRevealed ? 'Hide details' : 'Reveal details'} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition">
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      {isAdmin && !archivedView && tab === 'customer' && (
                        promotingId === u.id ? (
                          <Select
                            defaultOpen
                            value=""
                            onChange={position => position && promote(u.id, position)}
                            onClose={() => setPromotingId(null)}
                            placeholder="Promote to..."
                            options={DEPARTMENT_OPTIONS}
                            className="w-48"
                          />
                        ) : (
                          <button onClick={() => setPromotingId(u.id)} title="Promote to employee" className="p-1.5 rounded-lg bg-teal-50 text-[#00806f] hover:bg-teal-100 transition">
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                      {archivedView ? (
                        canManage && (
                          <>
                            <button onClick={() => restoreUser(u.id)} title={isAdmin ? 'Restore' : 'Request restore'} className="p-1.5 rounded-lg bg-teal-50 text-[#00806f] hover:bg-teal-100 transition"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setConfirmDeleteId(u.id)} title={isAdmin ? 'Delete permanently' : 'Request permanent deletion'} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )
                      ) : (
                        canManage && (u.role !== 'admin' || (isAdmin && u.id !== currentUser?.id)) && (
                          <button onClick={() => setConfirmArchiveId(u.id)} title={isAdmin ? 'Archive' : 'Request archive'} className="p-1.5 rounded-lg bg-orange-50 text-brand-orange hover:bg-orange-100 transition"><Archive className="w-3.5 h-3.5" /></button>
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
        <Pagination page={currentPage} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
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
