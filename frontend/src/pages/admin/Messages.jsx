import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, MessageSquare, Megaphone, Search, ArrowLeft } from 'lucide-react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { POSITION_LABELS, ROLE_LABELS, timeAgo } from '../../data/auditActions';

// Sentinel conversation id for the staff-wide channel — user ids are UUIDs, so it can't collide.
const GENERAL = 'general';
// There's no push channel, so the open conversation and the unread badges refresh on a timer
// while the tab is visible.
const POLL_MS = 15000;

const staffLabel = (person) => (person.role === 'admin' ? ROLE_LABELS.admin : POSITION_LABELS[person.position] || 'Employee');
const initials = (person) => `${person.first_name?.[0] || ''}${person.last_name?.[0] || ''}`.toUpperCase() || '?';

// Every staff member can message any other staff member directly, and everyone shares the
// General channel pinned at the top of the list for announcements and team-wide chat.
export default function Messages() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const withId = searchParams.get('with');
  const [directory, setDirectory] = useState(null);
  const [activeId, setActiveId] = useState(withId || GENERAL);
  // Phones only have room for one pane: the list, or the open conversation.
  const [mobileView, setMobileView] = useState(withId ? 'chat' : 'list');
  const [conversation, setConversation] = useState(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const activeIdRef = useRef(activeId);
  const scrollRef = useRef(null);
  const lastScrollKey = useRef('');

  const loadDirectory = () => api.get('/messages/threads').then(setDirectory).catch(() => {});

  // Responses for a conversation the user has already switched away from are dropped, so a
  // slow request can't paint the wrong chat.
  const loadConversation = (id) => {
    const request = id === GENERAL
      ? api.get('/messages/general').then(d => ({ id, partner: null, messages: d.messages }))
      : api.get(`/messages/thread/${id}`).then(d => ({ id, partner: d.partner, messages: d.messages }));
    return request
      .then(next => { if (activeIdRef.current === id) setConversation(next); })
      .catch(() => { if (activeIdRef.current === id) setConversation({ id, partner: null, messages: [], error: true }); });
  };

  useEffect(() => {
    if (withId) { setActiveId(withId); setMobileView('chat'); }
  }, [withId]);

  useEffect(() => {
    activeIdRef.current = activeId;
    setConversation(null);
    // Opening a conversation marks it read server-side, so refresh the badges afterwards.
    loadConversation(activeId).then(loadDirectory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      loadConversation(activeIdRef.current).then(loadDirectory);
    }, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only jump to the bottom when a conversation opens or gains a message — not on every poll,
  // which would yank the view away from someone scrolled up reading history.
  useEffect(() => {
    if (!conversation || !scrollRef.current) return;
    const key = `${conversation.id}:${conversation.messages.length}`;
    if (key === lastScrollKey.current) return;
    lastScrollKey.current = key;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversation]);

  const open = (id) => {
    setMobileView('chat');
    setSendError('');
    if (id === activeId) return;
    setDraft('');
    setActiveId(id);
  };

  const send = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError('');
    try {
      if (activeId === GENERAL) await api.post('/messages/general', { body });
      else await api.post('/messages', { recipientId: activeId, body });
      setDraft('');
      await loadConversation(activeId);
      loadDirectory();
    } catch (err) {
      setSendError(err.message || 'Message not sent. Try again.');
    } finally {
      setSending(false);
    }
  };

  const filteredThreads = useMemo(() => {
    const threads = directory?.threads || [];
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(({ partner }) =>
      `${partner.first_name} ${partner.last_name} ${staffLabel(partner)} ${partner.staff_code || ''}`.toLowerCase().includes(q));
  }, [directory, search]);

  const isGeneral = activeId === GENERAL;
  const activePartner = isGeneral ? null : (directory?.threads.find(t => t.partner.id === activeId)?.partner || conversation?.partner);
  const memberCount = directory ? directory.threads.length + 1 : null;
  const generalLast = directory?.general.lastMessage;
  const generalPreview = generalLast
    ? `${generalLast.sender_id === user?.id ? 'You' : generalLast.first_name}: ${generalLast.body}`
    : 'Announcements & team chat';

  return (
    <AdminLayout title="Messages" subtitle="Chat with anyone on staff, or post to General for team-wide announcements.">
      <div className="card overflow-hidden" style={{ height: '70vh' }}>
        <div className="flex h-full">
          <aside className={`${mobileView === 'list' ? 'flex' : 'hidden'} md:flex w-full md:w-72 border-r border-gray-100 flex-col shrink-0 min-h-0`}>
            <div className="p-3 border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search staff..."
                  aria-label="Search staff"
                  className="input-field pl-9 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ConversationButton
                active={isGeneral}
                onClick={() => open(GENERAL)}
                avatar={<span className="w-9 h-9 rounded-full bg-orange-50 text-brand-orange flex items-center justify-center shrink-0"><Megaphone className="w-4 h-4" /></span>}
                title="General"
                preview={generalPreview}
                unread={directory?.general.unread || 0}
              />
              <p className="px-4 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                All Staff{directory ? ` (${directory.threads.length})` : ''}
              </p>
              {directory === null ? (
                <p className="px-4 py-3 text-sm text-gray-400">Loading...</p>
              ) : filteredThreads.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">{search.trim() ? 'No staff match your search.' : 'No other staff members yet.'}</p>
              ) : filteredThreads.map(({ partner, lastMessage, unread }) => (
                <ConversationButton
                  key={partner.id}
                  active={activeId === partner.id}
                  onClick={() => open(partner.id)}
                  avatar={<span className="w-9 h-9 rounded-full bg-brand-navy/10 text-brand-navy text-xs font-bold flex items-center justify-center shrink-0">{initials(partner)}</span>}
                  title={`${partner.first_name} ${partner.last_name}`}
                  preview={lastMessage ? `${lastMessage.sender_id === user?.id ? 'You: ' : ''}${lastMessage.body}` : staffLabel(partner)}
                  unread={unread}
                />
              ))}
            </div>
          </aside>

          <section className={`${mobileView === 'chat' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
            <div className="px-4 py-3 border-b border-gray-100 shrink-0 flex items-center gap-3">
              <button type="button" onClick={() => setMobileView('list')} className="md:hidden p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Back to conversations">
                <ArrowLeft className="w-4 h-4" />
              </button>
              {isGeneral ? (
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 flex items-center gap-2"><Megaphone className="w-4 h-4 text-brand-orange" /> General</p>
                  <p className="text-xs text-gray-400">Announcements & team chat{memberCount ? ` · ${memberCount} members` : ''}</p>
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{activePartner ? `${activePartner.first_name} ${activePartner.last_name}` : '—'}</p>
                  <p className="text-xs text-gray-400">{activePartner ? staffLabel(activePartner) : ''}</p>
                </div>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversation === null ? (
                <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
              ) : conversation.error ? (
                <p className="text-sm text-gray-400 text-center py-8">This conversation couldn't be loaded.</p>
              ) : conversation.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-gray-400 gap-2 py-12">
                  {isGeneral ? <Megaphone className="w-8 h-8 text-gray-300" /> : <MessageSquare className="w-8 h-8 text-gray-300" />}
                  <p className="text-sm">{isGeneral ? 'No posts yet. Share the first update with the team.' : 'No messages yet. Say hello!'}</p>
                </div>
              ) : conversation.messages.map((m, i) => {
                const mine = m.sender_id === user?.id;
                const showSender = isGeneral && !mine && conversation.messages[i - 1]?.sender_id !== m.sender_id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%] md:max-w-[70%]">
                      {showSender && (
                        <p className="text-xs text-gray-400 mb-1 px-1">
                          <span className="font-semibold text-gray-700">{m.first_name} {m.last_name}</span> · {staffLabel(m)}
                        </p>
                      )}
                      <div className={`rounded-2xl px-4 py-2 text-sm ${mine ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-800'}`}>
                        <p className="whitespace-pre-line break-words">{m.body}</p>
                        <p className={`text-[10px] mt-1 ${mine ? 'text-white/60' : 'text-gray-400'}`}>{timeAgo(m.created_at)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={send} className="p-3 border-t border-gray-100 shrink-0">
              {sendError && <p className="text-xs text-red-600 mb-2">{sendError}</p>}
              <div className="flex items-center gap-2">
                <input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder={isGeneral ? 'Post to everyone on staff...' : `Message ${activePartner?.first_name || ''}...`}
                  aria-label="Message"
                  className="input-field flex-1"
                />
                <button type="submit" disabled={!draft.trim() || sending} aria-label="Send" className="btn-primary p-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}

function ConversationButton({ active, onClick, avatar, title, preview, unread }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition flex items-center gap-3 ${active ? 'bg-teal-50 hover:bg-teal-50' : ''}`}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm text-gray-800 truncate ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>{title}</p>
          {unread > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-[#00806f] text-white text-[10px] font-bold flex items-center justify-center shrink-0">{unread}</span>}
        </div>
        <p className="text-xs text-gray-400 truncate mt-0.5">{preview}</p>
      </div>
    </button>
  );
}
