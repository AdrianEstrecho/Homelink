import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Send, RotateCcw, ChevronRight, AlertCircle, ArrowRight } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import SafeImage from '../SafeImage';
import ChatMarkdown from './ChatMarkdown';

// The server only ever looks at this many recent messages, so there's no point sending more.
const HISTORY_SENT = 16;
const MAX_CHARS = 2000;

const SUGGESTIONS = [
  'Best CCTV setup for ₱10,000?',
  'Aircon plus installation under ₱40,000',
  'Tell me about HomeLink',
  'What payment methods do you accept?',
];

// Under the sm breakpoint the panel covers the whole screen, so following a link out of it
// should get it out of the way; on larger screens it floats beside the page and stays open.
const isFullScreen = () => window.matchMedia('(max-width: 639px)').matches;

// What the speech bubble beside the closed chat button cycles through, under "Ask HomeLink AI".
const LAUNCHER_HINTS = [
  'Find the best fit for your budget',
  'Products, installation & more',
  'Delivery, payments & promos',
];

// The assistant's mascot. The full figure is the chat button and changes pose with the chat:
// standing at rest, waving (hi) when hovered, jumping as he's clicked, thinking while the chat is
// open or the customer is typing, and lighting up (answer) once a reply lands. Every pose shares
// one frame, so swapping them never shifts his feet. The heads are his avatar inside the chat.
const MASCOT_POSES = ['standing', 'hi', 'jump', 'thinking', 'answer'];
const mascotPose = (pose) => `/mascot/${pose}.webp`;
const mascotHead = (pose) => `/mascot/${pose}-head.webp`;
const HOP_MS = 800;

function MascotAvatar({ pose = 'answer', motion = 'mascot-pop' }) {
  return (
    <span className="w-7 h-7 rounded-full bg-white ring-1 ring-brand-orange/40 shadow-sm overflow-hidden shrink-0 mt-0.5">
      <img src={mascotHead(pose)} alt="" className={`w-full h-full object-cover ${motion}`} />
    </span>
  );
}

function ItemCard({ item, onNavigate }) {
  return (
    <Link
      to={item.url}
      onClick={onNavigate}
      className="group flex items-center gap-3 p-2 pr-3 rounded-xl border border-gray-200/80 bg-white hover:border-brand-orange/40 hover:shadow-sm transition"
    >
      <SafeImage src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-100 shrink-0" iconClassName="w-5 h-5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-brand-ink leading-snug line-clamp-2">{item.name}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {item.category && `${item.category} · `}
          <span className="font-semibold text-brand-navy">{item.type === 'service' ? `from ${formatPrice(item.price)}` : formatPrice(item.price)}</span>
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-orange transition shrink-0" />
    </Link>
  );
}

function TypingDots() {
  return (
    <div className="flex items-start gap-2" aria-label="Assistant is typing">
      <MascotAvatar pose="thinking" motion="mascot-working" />
      <div className="flex items-center gap-1 px-4 py-3.5 w-fit rounded-2xl rounded-tl-md bg-white border border-gray-100 shadow-sm">
        {[0, 150, 300].map(delay => (
          <span key={delay} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
        ))}
      </div>
    </div>
  );
}

export default function AssistantWidget({ hidden = false }) {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Counts clicks on the mascot; each new value remounts him with the jump animation.
  const [hops, setHops] = useState(0);
  const [jumping, setJumping] = useState(false);
  // True from the moment a reply lands until the customer starts typing again.
  const [answered, setAnswered] = useState(false);
  const [hint, setHint] = useState(0);
  const openTimer = useRef(null);
  const jumpTimer = useRef(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  // Bumped by every request and by "new chat", so a reply that lands after the conversation it
  // belonged to was cleared can't write itself back in.
  const requestId = useRef(0);

  const isCustomer = user?.role === 'customer';
  const suggestions = isCustomer ? [...SUGGESTIONS.slice(0, 3), 'Where is my latest order?'] : SUGGESTIONS;

  // The chat button only appears once the backend confirms a Gemini key is configured.
  useEffect(() => {
    api.get('/assistant/status').then(data => setEnabled(!!data.enabled)).catch(() => {});
  }, []);

  useEffect(() => () => { clearTimeout(openTimer.current); clearTimeout(jumpTimer.current); }, []);

  // Cycle the bubble's hint line while the chat is closed, unless the visitor prefers less motion.
  useEffect(() => {
    if (open || !enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => setHint(h => (h + 1) % LAUNCHER_HINTS.length), 4500);
    return () => clearInterval(timer);
  }, [open, enabled]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // A new reply is brought in from its first line, so a long answer with cards under it isn't
  // scrolled past; anything else (a sent message, the typing dots, an error) pins to the bottom.
  useEffect(() => {
    const list = scrollRef.current;
    if (!list) return;
    const latest = list.querySelector('[data-latest-reply]');
    const top = latest && !loading && !error ? latest.offsetTop - 12 : list.scrollHeight;
    list.scrollTo({ top, behavior: 'smooth' });
  }, [messages, loading, error]);

  // Grow the textarea with its content, up to about five lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input, open]);

  const ask = async (history) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const { reply, items } = await api.post('/assistant/chat', {
        messages: history.slice(-HISTORY_SENT).map(({ role, content }) => ({ role, content })),
      });
      if (id === requestId.current) {
        setMessages([...history, { role: 'assistant', content: reply, items }]);
        setAnswered(true);
      }
    } catch (err) {
      if (id === requestId.current) setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  const send = (text) => {
    const content = text.trim();
    if (!content || loading) return;
    const history = [...messages, { role: 'user', content }];
    setMessages(history);
    setInput('');
    ask(history);
  };

  const resetChat = () => {
    requestId.current++;
    setMessages([]);
    setError(null);
    setLoading(false);
    setAnswered(false);
    setInput('');
    inputRef.current?.focus();
  };

  const handleNavigate = () => {
    if (isFullScreen()) setOpen(false);
  };

  // Every click makes the mascot jump. On a phone the chat opens just after he takes off, since
  // the full-screen panel would otherwise cover him before anyone sees the jump.
  const toggleOpen = () => {
    setHops(h => h + 1);
    setJumping(true);
    clearTimeout(jumpTimer.current);
    jumpTimer.current = setTimeout(() => setJumping(false), HOP_MS);
    clearTimeout(openTimer.current);
    if (open) { setOpen(false); return; }
    // Opening starts him off thinking, even on a conversation he'd already answered.
    setAnswered(false);
    openTimer.current = setTimeout(() => setOpen(true), isFullScreen() ? 380 : 0);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  if (!enabled || hidden) return null;

  const pose = jumping ? 'jump' : !open ? 'standing' : answered && !loading ? 'answer' : 'thinking';
  // At rest the standing and waving poses trade places on hover or keyboard focus in CSS alone,
  // so they react instantly; every other pose is chosen by the chat state above.
  const poseClass = (name) => {
    if (pose === 'standing' && name === 'standing') return 'opacity-100 group-hover:opacity-0 group-focus-visible:opacity-0';
    if (pose === 'standing' && name === 'hi') return 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100';
    return pose === name ? 'opacity-100' : 'opacity-0';
  };
  // Inside the chat his avatar only ever thinks or answers; keyed on that, so it pops on each change.
  const headPose = pose === 'answer' ? 'answer' : 'thinking';

  const greeting = `Hi${isCustomer && user.firstName ? ` ${user.firstName}` : ''}! I'm the HomeLink Assistant. Tell me your budget and what you need, and I'll suggest products and services that fit. I can also answer questions about HomeLink, delivery, payments and our policies.`;

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="HomeLink Assistant"
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          className="toast-in modal-panel fixed z-[90] inset-0 rounded-none sm:inset-auto sm:bottom-[8.5rem] sm:right-5 sm:w-[400px] sm:h-[min(620px,calc(100vh-10.5rem))] sm:rounded-2xl flex flex-col overflow-hidden"
        >
          <div className="relative flex items-center gap-3 px-4 py-3 bg-brand-navy text-white shrink-0 overflow-hidden">
            <div aria-hidden="true" className="absolute -top-10 -right-6 w-32 h-32 rounded-full bg-brand-orange/25 blur-2xl" />
            <div className="relative w-11 h-11 rounded-full bg-white ring-2 ring-brand-orange/70 overflow-hidden shrink-0">
              <img key={headPose} src={mascotHead(headPose)} alt="" className="mascot-pop w-full h-full object-cover" />
            </div>
            <div className="relative min-w-0 flex-1">
              <p className="font-display font-bold leading-tight">HomeLink Assistant</p>
              <p className="text-xs text-white/65 truncate">Powered by Gemini</p>
            </div>
            {messages.length > 0 && (
              <button onClick={resetChat} aria-label="Start a new chat" title="New chat" className="relative p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition">
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setOpen(false)} aria-label="Close assistant" className="relative p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div ref={scrollRef} aria-live="polite" className="relative flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 bg-brand-light/60 text-sm">
            <div className="flex items-start gap-2">
              <MascotAvatar pose="hi" />
              <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-white border border-gray-100 shadow-sm px-3.5 py-2.5 text-gray-700 leading-relaxed">
                {greeting}
              </div>
            </div>

            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 pt-1 pl-9">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="px-3 py-1.5 rounded-full border border-brand-navy/15 bg-white text-xs font-medium text-brand-navy hover:border-brand-orange hover:text-brand-orange transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (m.role === 'user' ? (
              <div key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand-navy text-white px-3.5 py-2 whitespace-pre-wrap break-words leading-relaxed">
                {m.content}
              </div>
            ) : (
              <div key={i} data-latest-reply={i === messages.length - 1 || undefined} className="flex items-start gap-2">
                <MascotAvatar />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="w-fit max-w-full rounded-2xl rounded-tl-md bg-white border border-gray-100 shadow-sm px-3.5 py-2.5 text-gray-700 leading-relaxed break-words">
                    <ChatMarkdown text={m.content} onNavigate={handleNavigate} />
                  </div>
                  {m.items?.length > 0 && (
                    <div className="space-y-2">
                      {m.items.map(item => <ItemCard key={item.url} item={item} onNavigate={handleNavigate} />)}
                    </div>
                  )}
                </div>
              </div>
            )))}

            {loading && <TypingDots />}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="flex-1">{error}</p>
                <button onClick={() => ask(messages)} className="font-semibold text-red-700 hover:underline shrink-0">Try again</button>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="shrink-0 border-t border-gray-200/70 bg-white/80 px-3 pt-3 pb-2"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); setAnswered(false); }}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={MAX_CHARS}
                placeholder="Ask about products, budgets…"
                aria-label="Message the HomeLink Assistant"
                className="input-field resize-none py-2 text-base sm:text-sm leading-relaxed"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                aria-label="Send message"
                className="w-10 h-10 rounded-lg bg-brand-orange text-white flex items-center justify-center shrink-0 hover:bg-orange-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-gray-400 text-center mt-2">AI answers can be wrong. Check the product page before you buy.</p>
          </form>
        </div>
      )}

      <button
        onClick={toggleOpen}
        aria-label={open ? 'Close HomeLink Assistant' : 'Open HomeLink Assistant'}
        aria-expanded={open}
        className={`assistant-launcher group fixed z-[90] bottom-3 right-3 sm:bottom-4 sm:right-4 items-end ${open ? 'hidden sm:flex' : 'flex'}`}
      >
        {/* A speech bubble from the mascot, level with his face, so the label reads as him talking.
            It only slides out while he's hovered (or the button has keyboard focus). It sits outside
            the button's own box, so the hidden bubble can't catch the pointer, and its padding
            reaches back to the mascot, so moving from him onto the bubble keeps it open. */}
        {!open && (
          <span className="absolute right-full bottom-5 pr-3 hidden sm:block origin-right opacity-0 translate-x-2 scale-95 pointer-events-none transition duration-200 ease-out delay-100 motion-reduce:transition-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100 group-hover:pointer-events-auto group-hover:delay-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:scale-100">
            <span className="relative block w-[236px] text-left rounded-2xl bg-white border border-gray-100 pl-4 pr-3 py-2.5 shadow-[0_14px_34px_-12px_rgba(15,43,91,0.45)]">
              <span aria-hidden="true" className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-brand-orange" />
              <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-orange">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
                </span>
                AI Assistant · Online
              </span>
              <span className="mt-0.5 flex items-center justify-between gap-2">
                <span className="font-display text-[15px] font-extrabold tracking-tight text-brand-navy">Ask HomeLink AI</span>
                <span className="w-6 h-6 rounded-full bg-brand-orange/10 text-brand-orange flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:translate-x-0.5">
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </span>
              <span key={hint} className="assistant-hint block text-xs text-gray-500 truncate">{LAUNCHER_HINTS[hint]}</span>
              <span aria-hidden="true" className="absolute -right-[7px] top-1/2 -translate-y-1/2 rotate-45 w-3.5 h-3.5 bg-white border-t border-r border-gray-100" />
            </span>
          </span>
        )}
        <span key={hops} className={`relative block ${hops ? 'mascot-hop' : ''}`}>
          <span className="mascot-idle relative block h-[72px] sm:h-[100px] aspect-[231/300] drop-shadow-[0_8px_10px_rgba(15,43,91,0.35)]">
            {MASCOT_POSES.map(name => (
              <img
                key={name}
                src={mascotPose(name)}
                alt=""
                width="231"
                height="300"
                className={`absolute inset-0 w-full h-full transition-opacity duration-100 ${poseClass(name)}`}
              />
            ))}
          </span>
          {open && (
            <span className="absolute top-0 -right-1 w-6 h-6 rounded-full bg-brand-navy text-white ring-2 ring-white flex items-center justify-center">
              <X className="w-3.5 h-3.5" />
            </span>
          )}
        </span>
      </button>
    </>
  );
}
