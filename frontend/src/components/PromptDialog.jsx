import { useEffect, useState } from 'react';
import Modal, { ModalBody, ModalFooter, ModalHeader, modalButton } from './Modal';

export default function PromptDialog({
  open,
  title,
  message,
  placeholder,
  confirmLabel = 'Add',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  const [value, setValue] = useState('');

  useEffect(() => { if (open) setValue(''); }, [open]);

  const submit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <Modal open={open} onClose={onCancel} size="sm" as="form" onSubmit={submit} zIndex={110}>
      <ModalHeader title={title} subtitle={message} />
      <ModalBody>
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label={title}
          className="input-field"
        />
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onCancel} className={`${modalButton.base} ${modalButton.secondary}`}>
          {cancelLabel}
        </button>
        <button type="submit" disabled={!value.trim()} className={`${modalButton.base} ${modalButton.primary}`}>
          {confirmLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}
