import Modal, { ModalFooter, ModalTitle, modalButton } from './Modal';

// Tones reuse the same category colors as the admin activity feed
// (see CATEGORY_ICON in AdminLayout.jsx) so a confirmation's color always
// matches how that action later shows up in the audit trail.
const TONE_STYLES = {
  delete: { icon: 'bg-red-50 text-red-600 ring-red-50/60', confirm: 'bg-red-600 hover:bg-red-700 text-white' },
  archive: { icon: 'bg-purple-50 text-purple-600 ring-purple-50/60', confirm: 'bg-purple-600 hover:bg-purple-700 text-white' },
  update: { icon: 'bg-amber-50 text-amber-600 ring-amber-50/60', confirm: 'bg-amber-600 hover:bg-amber-700 text-white' },
  login: { icon: 'bg-blue-50 text-blue-600 ring-blue-50/60', confirm: 'bg-blue-600 hover:bg-blue-700 text-white' },
  create: { icon: 'bg-green-50 text-green-600 ring-green-50/60', confirm: 'bg-green-600 hover:bg-green-700 text-white' },
};

// Tones that destroy or hide something start with focus on Cancel, so a stray Enter can't do it.
const CAUTIOUS = new Set(['delete', 'archive']);

export default function ConfirmDialog({
  open,
  icon: Icon,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'delete',
  onConfirm,
  onCancel,
  zIndexClass = 'z-[100]',
}) {
  const { icon: iconClass, confirm: confirmClass } = TONE_STYLES[tone] || TONE_STYLES.delete;
  const cautious = CAUTIOUS.has(tone);
  // Callers stack a confirmation over another dialog by passing a higher z-[n] class.
  const zIndex = Number(zIndexClass.match(/\d+/)?.[0]) || 100;

  return (
    <Modal open={open} onClose={onCancel} size="sm" role="alertdialog" zIndex={zIndex}>
      <div className="px-6 pt-6 pb-5 flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-4">
        {Icon && (
          <span className={`w-12 h-12 rounded-full ring-8 flex items-center justify-center shrink-0 ${iconClass}`} aria-hidden="true">
            <Icon className="w-[22px] h-[22px]" />
          </span>
        )}
        <div className="min-w-0 sm:pt-1">
          <ModalTitle className="font-display text-lg font-bold leading-snug text-brand-ink">{title}</ModalTitle>
          {message && <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-line leading-relaxed">{message}</p>}
        </div>
      </div>
      <ModalFooter>
        <button type="button" onClick={onCancel} autoFocus={cautious} className={`${modalButton.base} ${modalButton.secondary}`}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm} autoFocus={!cautious} className={`${modalButton.base} ${confirmClass}`}>
          {confirmLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}
