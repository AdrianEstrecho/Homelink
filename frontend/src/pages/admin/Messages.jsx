import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, MessageSquare } from 'lucide-react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import { POSITION_LABELS, ROLE_LABELS, timeAgo } from '../../data/auditActions';

export default function Messages() {
  const [searchParams] = useSearchParams();
  const withId = searchParams.get('with');
  const [threads, setThreads] = useState(null);
  const [activePartnerId, setActivePartnerId] = useState(withId || null);
  const [activeThread, setActiveThread] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const loadThreads = () => api.get('/messages/threads').then(setThreads).catch(() => {});
  useEffect(() => { loadThreads(); }, []);

  useEffect(() => {
    if (withId) setActivePartnerId(withId);
  }, [withId]);

  const loadThread = (partnerId) => {
    if (!partnerId) { setActiveThread(null); return; }
    api.get(`/messages/thread/${partnerId}`).then(setActiveThread).catch(() => setActiveThread(null));
  };
  useEffect(() => { loadThread(activePartnerId); }, [activePartnerId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeThread]);

  const send = async (e) => {
    e.preventDefault();
    if (!draft.trim() || !activePartnerId) return;
    setSending(true);
    try {
      await api.post('/messages', { recipientId: activePartnerId, body: draft.trim() });
      setDraft('');
      loadThread(activePartnerId);
      loadThreads();
    } finally {
      setSending(false);
    }
  };

  const partnerRoleLabel = (partner) => (partner.role === 'admin' ? ROLE_LABELS.admin : POSITION_LABELS[partner.position] || 'Employee');

  return (
    <AdminLayout title="Messages" subtitle="Direct messages between coordinators and technicians.">
      <div className="card overflow-hidden" style={{ height: '70vh' }}>
        <div className="flex h-full">
          <div className="w-72 border-r border-gray-100 overflow-y-auto shrink-0">
            {threads === null ? (
              <p className="p-4 text-sm text-gray-400">Loading...</p>
            ) : threads.length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">No conversations yet.</p>
            ) : threads.map(t => (
              <button
                key={t.partner.id}
                onClick={() => setActivePartnerId(t.partner.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition ${activePartnerId === t.partner.id ? 'bg-teal-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm text-gray-800 truncate">{t.partner.first_name} {t.partner.last_name}</p>
                  {t.unread > 0 && <span className="w-5 h-5 rounded-full bg-[#00806f] text-white text-[10px] font-bold flex items-center justify-center shrink-0">{t.unread}</span>}
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">{t.lastMessage?.body || '—'}</p>
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            {!activeThread ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
                <MessageSquare className="w-8 h-8 text-gray-300" />
                <p className="text-sm">Select a conversation to start messaging.</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                  <p className="font-semibold text-gray-800">{activeThread.partner.first_name} {activeThread.partner.last_name}</p>
                  <p className="text-xs text-gray-400">{partnerRoleLabel(activeThread.partner)}</p>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {activeThread.messages.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No messages yet. Say hello!</p>
                  ) : activeThread.messages.map(m => {
                    const fromPartner = m.sender_id === activeThread.partner.id;
                    return (
                      <div key={m.id} className={`flex ${fromPartner ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${fromPartner ? 'bg-gray-100 text-gray-800' : 'bg-brand-navy text-white'}`}>
                          <p className="whitespace-pre-line">{m.body}</p>
                          <p className={`text-[10px] mt-1 ${fromPartner ? 'text-gray-400' : 'text-white/60'}`}>{timeAgo(m.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={send} className="p-3 border-t border-gray-100 flex items-center gap-2 shrink-0">
                  <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder="Type a message..."
                    className="input-field flex-1"
                  />
                  <button type="submit" disabled={!draft.trim() || sending} className="btn-primary p-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
