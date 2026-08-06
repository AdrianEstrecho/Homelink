import { FileText, X } from 'lucide-react';
import { termsSections } from '../data/termsContent';

export default function TermsModal({ open, onClose }) {
  if (!open) return null;

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

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {termsSections.map(s => (
            <div key={s.title}>
              <h3 className="font-semibold text-sm text-brand-navy mb-1">{s.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{s.content}</p>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose} className="btn-primary w-full py-2.5">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
