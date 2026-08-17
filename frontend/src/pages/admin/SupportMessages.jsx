import { useEffect, useState } from 'react';
import { LifeBuoy, Send } from 'lucide-react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import { timeAgo } from '../../data/auditActions';
import { formatTicketNo } from '../../utils/ticketNumber';

const TYPE_STYLE = { support: 'bg-blue-100 text-blue-800', complaint: 'bg-red-100 text-red-800' };
const STATUS_STYLE = { open: 'bg-amber-100 text-amber-800', resolved: 'bg-green-100 text-green-800' };
const PENDING_STYLE = 'bg-purple-100 text-purple-800';

export default function AdminSupportMessages() {
  const [messages, setMessages] = useState([]);
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState('open');
  const [drafts, setDrafts] = useState({});
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/admin/support-messages').then(setMessages).catch(() => {});
  // Whether a ticket's resolution is awaiting HR/admin sign-off isn't a column on the ticket
  // itself — it's derived from having a pending change_requests row, same as JobStatus.jsx
  // does for installers' job completions.
  const loadRequests = () => api.get('/admin/approvals/mine').then(rows => setRequests(rows.filter(r => r.entity_type === 'support'))).catch(() => {});
  useEffect(() => { load(); loadRequests(); }, []);

  const isPending = (id) => requests.some(r => r.entity_id === id && r.status === 'pending');

  const openCount = messages.filter(m => m.status === 'open').length;
  const resolvedCount = messages.filter(m => m.status === 'resolved').length;
  const filtered = messages.filter(m => m.status === tab);

  const setDraft = (id, value) => setDrafts(d => ({ ...d, [id]: value }));

  const sendReply = async (id) => {
    const body = (drafts[id] || '').trim();
    if (!body) return;
    setSendingId(id);
    setError('');
    try {
      await api.post(`/admin/support-messages/${id}/reply`, { body });
      setDraft(id, '');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingId(null);
    }
  };

  const requestResolve = async (id) => {
    setError('');
    try {
      await api.put(`/admin/support-messages/${id}/resolve`);
      loadRequests();
    } catch (err) {
      setError(err.message);
    }
  };

  const reopen = async (id) => {
    setError('');
    try {
      await api.put(`/admin/support-messages/${id}/reopen`);
      load();
      loadRequests();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <AdminLayout title="Support Messages" subtitle="Customer support inquiries and complaints.">
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

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
          {filtered.map(m => {
            const pending = isPending(m.id);
            return (
              <div key={m.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-semibold text-brand-navy bg-brand-navy/10 rounded px-1.5 py-0.5">{formatTicketNo(m.ticket_number)}</span>
                      <p className="font-semibold text-gray-800">{m.subject}</p>
                      <span className={`badge capitalize ${TYPE_STYLE[m.type]}`}>{m.type}</span>
                    </div>
                    <p className="text-xs text-gray-400">{m.first_name} {m.last_name} · {m.email} · {new Date(m.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`badge ${pending ? PENDING_STYLE : STATUS_STYLE[m.status]}`}>
                      {pending ? 'Pending HR Approval' : m.status === 'open' ? 'Open' : 'Resolved'}
                    </span>
                    {m.status === 'open' && !pending && (
                      <button onClick={() => requestResolve(m.id)} className="text-xs font-medium text-brand-navy hover:underline">Request Resolution</button>
                    )}
                    {m.status === 'resolved' && (
                      <button onClick={() => reopen(m.id)} className="text-xs font-medium text-brand-navy hover:underline">Reopen</button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-3">{m.message}</p>

                {m.replies?.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    {m.replies.map(r => (
                      <div key={r.id} className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-sm text-gray-700">{r.body}</p>
                        <p className="text-xs text-gray-400 mt-1">{r.author_first_name} {r.author_last_name} · {timeAgo(r.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <input
                    value={drafts[m.id] || ''}
                    onChange={e => setDraft(m.id, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendReply(m.id); }}
                    placeholder="Write a reply..."
                    className="input-field text-sm py-1.5"
                  />
                  <button
                    onClick={() => sendReply(m.id)}
                    disabled={sendingId === m.id || !(drafts[m.id] || '').trim()}
                    className="btn-primary flex items-center gap-1.5 text-sm py-1.5 px-3 disabled:opacity-60 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" /> Reply
                  </button>
                </div>
              </div>
            );
          })}
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
