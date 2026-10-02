import { useEffect, useId, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Modal, { ModalBody, ModalFooter, ModalHeader, modalButton } from './Modal';

// A confirmation with a required reason field, since a plain confirm/cancel isn't enough
// for order & booking cancellations.
export default function CancelReasonModal({ open, title, message, onSubmit, onCancel }) {
  const fieldId = useId();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setReason(''); setError(''); setSubmitting(false); }
  }, [open]);

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

  return (
    <Modal open={open} onClose={onCancel} dismissible={!submitting} size="sm" as="form" onSubmit={submit} zIndex={110} role="alertdialog">
      <ModalHeader icon={AlertTriangle} tone="red" title={title} subtitle={message} />
      <ModalBody>
        <label htmlFor={fieldId} className="block text-sm font-medium text-brand-ink mb-1.5">Reason for cancellation</label>
        <textarea
          id={fieldId}
          autoFocus
          rows={3}
          value={reason}
          onChange={e => { setReason(e.target.value); if (error) setError(''); }}
          placeholder="Let us know what changed..."
          disabled={submitting}
          aria-invalid={error ? true : undefined}
          className="input-field resize-none disabled:opacity-60"
        />
        {error && <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onCancel} disabled={submitting} className={`${modalButton.base} ${modalButton.secondary}`}>
          Keep it
        </button>
        <button type="submit" disabled={submitting} className={`${modalButton.base} bg-red-600 hover:bg-red-700 text-white`}>
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Submit'}
        </button>
      </ModalFooter>
    </Modal>
  );
}
