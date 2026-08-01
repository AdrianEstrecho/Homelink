import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import Select from '../../components/Select';
import { ACTION_META, CATEGORY_STYLE, formatDateTime } from '../../data/auditActions';

const CATEGORIES = [
  { key: '', label: 'All Actions' },
  { key: 'create', label: 'Create' },
  { key: 'update', label: 'Update' },
  { key: 'delete', label: 'Delete' },
  { key: 'login', label: 'Login' },
  { key: 'archive', label: 'Archive' },
];

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [category, setCategory] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/users').then(users => setStaff(users.filter(u => u.role !== 'customer'))).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = userFilter ? `?userId=${userFilter}` : '';
    api.get(`/admin/audit-logs${qs}`).then(setLogs).catch(() => {}).finally(() => setLoading(false));
  }, [userFilter]);

  const nameOf = useMemo(() => {
    const map = Object.fromEntries(staff.map(u => [u.id, `${u.first_name} ${u.last_name}`]));
    return (id) => map[id];
  }, [staff]);

  const counts = useMemo(() => {
    const c = { '': logs.length };
    CATEGORIES.slice(1).forEach(({ key }) => { c[key] = logs.filter(l => ACTION_META[l.action]?.category === key).length; });
    return c;
  }, [logs]);

  const filtered = category ? logs.filter(l => ACTION_META[l.action]?.category === category) : logs;

  return (
    <AdminLayout title="Audit Trail" subtitle="Review admin and employee activity across the system.">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${category === c.key ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {c.label} ({counts[c.key] || 0})
            </button>
          ))}
        </div>
        <Select
          value={userFilter}
          onChange={setUserFilter}
          options={[{ value: '', label: 'All staff members' }, ...staff.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))]}
          className="w-56"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className="p-3 font-medium">Date &amp; Time</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">Entity</th>
                <th className="p-3 font-medium">Admin</th>
                <th className="p-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">No activity recorded yet.</td></tr>
              ) : filtered.map(log => {
                const meta = ACTION_META[log.action];
                return (
                  <tr key={log.id} className="border-t border-gray-100">
                    <td className="p-3 text-gray-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="p-3">
                      <span className={`badge uppercase font-semibold ${CATEGORY_STYLE[meta?.category] || 'bg-gray-100 text-gray-800'}`}>
                        {meta?.category || log.action}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600">{meta?.entity || log.entity_type || '—'}</td>
                    <td className="p-3">
                      {log.first_name ? (
                        <>
                          <p className="font-medium text-gray-800">{log.first_name} {log.last_name}</p>
                          <p className="text-xs text-gray-400 font-mono">{log.staff_code || '—'}</p>
                        </>
                      ) : <span className="text-gray-400">Deleted user</span>}
                    </td>
                    <td className="p-3 text-gray-600">{meta && log.details ? meta.describe(log.details, nameOf) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
