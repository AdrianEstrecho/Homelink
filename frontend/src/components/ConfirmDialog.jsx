export default function ConfirmDialog({
  open,
  icon: Icon,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 fade-up">
        {Icon && (
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
            <Icon className="w-6 h-6" />
          </div>
        )}
        <h2 className="font-display text-lg font-bold text-brand-navy">{title}</h2>
        {message && <p className="text-sm text-gray-600 mt-1.5">{message}</p>}
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
            className="flex-1 rounded-lg py-2.5 font-semibold text-sm text-white bg-red-600 hover:bg-red-700 transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
