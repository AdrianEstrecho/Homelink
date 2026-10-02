import { useEffect, useId, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import Modal, { ModalBody, ModalFooter, ModalHeader, modalButton } from './Modal';

// Same shape as CancelReasonModal, with its own submitting/error state. The note is required
// here: it's the only explanation the customer ever gets for a rejection.
export default function RejectReturnDialog({ open, customer, kind = 'return', onSubmit, onCancel }) {
  // Rejecting the two kinds refuses different things, and the difference matters: refusing a
  // return leaves the customer holding goods they still own, while refusing a cancellation refund
  // leaves them out of pocket on an order that stays cancelled either way.
  const cancellation = kind === 'cancellation';
  const fieldId = useId();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setNote(''); setError(''); setSubmitting(false); }
  }, [open]);

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

  return (
    <Modal open={open} onClose={onCancel} dismissible={!submitting} size="sm" as="form" onSubmit={submit} zIndex={110} role="alertdialog">
      <ModalHeader
        icon={X}
        tone="red"
        title={cancellation ? 'Decline this refund?' : 'Reject this return?'}
        subtitle={<>
          {customer ? `${customer} will be emailed this note. ` : ''}
          {cancellation ? 'The order stays cancelled — only the refund is refused.' : 'Stock is not affected.'}
        </>}
      />
      <ModalBody>
        <label htmlFor={fieldId} className="block text-sm font-medium text-brand-ink mb-1.5">
          {cancellation ? 'Reason for declining' : 'Reason for rejection'}
        </label>
        <textarea
          id={fieldId}
          autoFocus
          rows={3}
          value={note}
          onChange={(e) => { setNote(e.target.value); if (error) setError(''); }}
          placeholder={cancellation ? "Explain why this refund can't be sent..." : "Explain why this return can't be accepted..."}
          disabled={submitting}
          aria-invalid={error ? true : undefined}
          className="input-field resize-none disabled:opacity-60"
        />
        {error && <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onCancel} disabled={submitting} className={`${modalButton.base} ${modalButton.secondary}`}>
          Keep pending
        </button>
        <button type="submit" disabled={submitting} className={`${modalButton.base} bg-red-600 hover:bg-red-700 text-white`}>
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> {cancellation ? 'Declining…' : 'Rejecting…'}</>
            : (cancellation ? 'Decline' : 'Reject')}
        </button>
      </ModalFooter>
    </Modal>
  );
}
