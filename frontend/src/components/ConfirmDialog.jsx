// Tones reuse the same category colors as the admin activity feed
// (see CATEGORY_ICON in AdminLayout.jsx) so a confirmation's color always
// matches how that action later shows up in the audit trail.
const TONE_STYLES = {
  delete: { icon: 'bg-red-100 text-red-600', confirm: 'bg-red-600 hover:bg-red-700' },
  archive: { icon: 'bg-purple-100 text-purple-600', confirm: 'bg-purple-600 hover:bg-purple-700' },
  update: { icon: 'bg-amber-100 text-amber-600', confirm: 'bg-amber-600 hover:bg-amber-700' },
  login: { icon: 'bg-blue-100 text-blue-600', confirm: 'bg-blue-600 hover:bg-blue-700' },
  create: { icon: 'bg-green-100 text-green-600', confirm: 'bg-green-600 hover:bg-green-700' },
};

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
  if (!open) return null;
  const { icon: iconClass, confirm: confirmClass } = TONE_STYLES[tone] || TONE_STYLES.delete;

  return (
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4`}>
      <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 fade-up">
        {Icon && (
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${iconClass}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
        <h2 className="font-display text-lg font-bold text-brand-navy">{title}</h2>
        {message && <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-line">{message}</p>}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-gray-300 rounded-lg py-2.5 font-medium text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-lg py-2.5 font-semibold text-sm text-white transition ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
