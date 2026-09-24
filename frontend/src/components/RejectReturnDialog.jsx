import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Same shape as CancelReasonModal — portaled, with its own submitting/error state — rather than
// PromptDialog, which isn't portaled and so can't sit above a card's own stacking context. The
// note is required here: it's the only explanation the customer ever gets for a rejection.
export default function RejectReturnDialog({ open, customer, onSubmit, onCancel }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setNote(''); setError(''); setSubmitting(false); }
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = note.trim();
    if (trimmed.length < 5) { setError('Please give the customer a reason for the rejection.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="modal-scrim" onClick={submitting ? undefined : onCancel} />
      <form onSubmit={submit} className="modal-panel w-full max-w-sm p-6 fade-up">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-red-100 text-red-600">
          <X className="w-6 h-6" />
        </div>
        <h2 className="font-display text-lg font-bold text-brand-navy">Reject this return?</h2>
        <p className="text-sm text-gray-600 mt-1.5">
          {customer ? `${customer} will be emailed this note. ` : ''}Stock is not affected.
        </p>

        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-1.5">
          Reason for rejection
        </label>
        <textarea
          autoFocus
          rows={3}
          value={note}
          onChange={(e) => { setNote(e.target.value); if (error) setError(''); }}
          placeholder="Explain why this return can't be accepted..."
          disabled={submitting}
          className="input-field resize-none disabled:opacity-60"
        />
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onCancel} disabled={submitting} className="flex-1 border border-gray-300 rounded-lg py-2.5 font-medium text-sm text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
            Keep Pending
          </button>
          <button type="submit" disabled={submitting} className="flex-1 rounded-lg py-2.5 font-semibold text-sm text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50">
            {submitting ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
