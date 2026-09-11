import { useEffect, useRef, useState } from 'react';
import { FileText, X, ChevronDown } from 'lucide-react';
import { termsSections } from '../data/termsContent';

// When onAccept is passed (the signup flow), the reader must scroll to the bottom before
// Accept unlocks, and Accept/Decline replace the plain Close button. Without it, this renders
// as a read-only viewer (e.g. footer "Terms" link) — same modal, just no gate.
export default function TermsModal({ open, onClose, onAccept, onDecline }) {
  const requireAcceptance = Boolean(onAccept);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setScrolledToBottom(false);
    if (!requireAcceptance) return;
    // If the content already fits without scrolling, there's nothing to scroll to — don't
    // block Accept on a scrollbar that will never appear.
    const raf = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el && el.scrollHeight - el.clientHeight < 24) setScrolledToBottom(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [open, requireAcceptance]);

  if (!open) return null;

  const handleScroll = (e) => {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setScrolledToBottom(true);
  };

  const handleDecline = () => (onDecline ? onDecline() : onClose());

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="modal-scrim" onClick={onClose} />
      <div className="modal-panel w-full max-w-2xl max-h-[85vh] flex flex-col fade-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-brand-navy" />
            <h2 className="font-display text-lg font-bold text-brand-navy">Terms &amp; Conditions</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          ref={scrollRef}
          onScroll={requireAcceptance ? handleScroll : undefined}
          className="overflow-y-auto px-6 py-5 space-y-5"
        >
          {termsSections.map(s => (
            <div key={s.title}>
              <h3 className="font-semibold text-sm text-brand-navy mb-1">{s.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{s.content}</p>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
          {requireAcceptance && !scrolledToBottom && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <ChevronDown className="w-3.5 h-3.5 animate-bounce" /> Scroll down to read the full terms
            </p>
          )}
          {requireAcceptance ? (
            <div className="flex gap-3">
              <button type="button" onClick={handleDecline} className="btn-secondary flex-1 py-2.5">
                Decline
              </button>
              <button
                type="button"
                onClick={onAccept}
                disabled={!scrolledToBottom}
                title={scrolledToBottom ? undefined : 'Scroll to the bottom to enable Accept'}
                className="btn-primary flex-1 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Accept
              </button>
            </div>
          ) : (
            <button type="button" onClick={onClose} className="btn-primary w-full py-2.5">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
