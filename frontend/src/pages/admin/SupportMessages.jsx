import { useEffect, useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

const TYPE_STYLE = { support: 'bg-blue-100 text-blue-800', complaint: 'bg-red-100 text-red-800' };
const STATUS_STYLE = { open: 'bg-amber-100 text-amber-800', resolved: 'bg-green-100 text-green-800' };

export default function AdminSupportMessages() {
  const [messages, setMessages] = useState([]);
  const [tab, setTab] = useState('open');

  const load = () => api.get('/admin/support-messages').then(setMessages).catch(() => {});
  useEffect(() => { load(); }, []);

  const toggle = async (id) => { await api.put(`/admin/support-messages/${id}/toggle`); load(); };

  const openCount = messages.filter(m => m.status === 'open').length;
  const resolvedCount = messages.filter(m => m.status === 'resolved').length;
  const filtered = messages.filter(m => m.status === tab);

  return (
    <AdminLayout title="Support Messages" subtitle="Customer support inquiries and complaints.">
      <div className="flex items-center gap-2 mb-4">
        <TabButton active={tab === 'open'} onClick={() => setTab('open')}>Open ({openCount})</TabButton>
        <TabButton active={tab === 'resolved'} onClick={() => setTab('resolved')}>Resolved ({resolvedCount})</TabButton>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <LifeBuoy className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No {tab} messages.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-gray-800">{m.subject}</p>
                    <span className={`badge capitalize ${TYPE_STYLE[m.type]}`}>{m.type}</span>
                  </div>
                  <p className="text-xs text-gray-400">{m.first_name} {m.last_name} · {m.email} · {new Date(m.created_at).toLocaleString()}</p>
                </div>
                <button onClick={() => toggle(m.id)} className={`badge shrink-0 transition hover:opacity-80 ${STATUS_STYLE[m.status]}`}>
                  {m.status === 'open' ? 'Mark Resolved' : 'Reopen'}
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-3">{m.message}</p>
            </div>
          ))}
        </div>
      )}
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
