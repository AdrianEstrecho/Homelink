import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

// Portaled like ConfirmDialog (see that file for why) but adds a required reason
// field, since a plain confirm/cancel isn't enough for order & booking cancellations.
export default function CancelReasonModal({ open, title, message, onSubmit, onCancel }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setReason(''); setError(''); setSubmitting(false); }
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) { setError('Please tell us why you’re cancelling.'); return; }
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
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="font-display text-lg font-bold text-brand-navy">{title}</h2>
        {message && <p className="text-sm text-gray-600 mt-1.5">{message}</p>}

        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-1.5">
          Reason for cancellation
        </label>
        <textarea
          autoFocus
          rows={3}
          value={reason}
          onChange={e => { setReason(e.target.value); if (error) setError(''); }}
          placeholder="Let us know what changed..."
          disabled={submitting}
          className="input-field resize-none disabled:opacity-60"
        />
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 border border-gray-300 rounded-lg py-2.5 font-medium text-sm text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            Keep It
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg py-2.5 font-semibold text-sm text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
