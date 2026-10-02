import { useEffect, useRef, useState } from 'react';
import { FileText, ChevronDown } from 'lucide-react';
import { termsSections } from '../data/termsContent';
import Modal, { ModalBody, ModalFooter, ModalHeader, modalButton } from './Modal';

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

  const handleScroll = (e) => {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setScrolledToBottom(true);
  };

  const handleDecline = () => (onDecline ? onDecline() : onClose());

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader
        icon={FileText}
        title="Terms & Conditions"
        subtitle={requireAcceptance ? 'Read to the end to accept and finish creating your account.' : 'The rules for shopping and booking with HomeLink.'}
      />
      <ModalBody ref={scrollRef} onScroll={requireAcceptance ? handleScroll : undefined} className="space-y-5">
        {termsSections.map((s, i) => (
          <section key={s.title} className="flex gap-3">
            <span className="drafting text-[11px] text-gray-400 w-5 pt-0.5 shrink-0 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-brand-ink mb-1">{s.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{s.content}</p>
            </div>
          </section>
        ))}
      </ModalBody>
      <ModalFooter>
        {requireAcceptance && !scrolledToBottom && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-gray-500 sm:mr-auto" aria-live="polite">
            <ChevronDown className="w-3.5 h-3.5 animate-bounce" /> Scroll down to read the full terms
          </p>
        )}
        {requireAcceptance ? (
          <>
            <button type="button" onClick={handleDecline} className={`${modalButton.base} ${modalButton.secondary}`}>
              Decline
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={!scrolledToBottom}
              title={scrolledToBottom ? undefined : 'Scroll to the bottom to enable Accept'}
              className={`${modalButton.base} ${modalButton.primary}`}
            >
              Accept
            </button>
          </>
        ) : (
          <button type="button" onClick={onClose} className={`${modalButton.base} ${modalButton.primary}`}>
            Close
          </button>
        )}
      </ModalFooter>
    </Modal>
  );
}
