import { useEffect, useState } from 'react';

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

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={onCancel} />
      <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 fade-up">
        <h2 className="font-display text-lg font-bold text-brand-navy">{title}</h2>
        {message && <p className="text-sm text-gray-600 mt-1.5">{message}</p>}
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          className="input-field mt-4"
        />
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 rounded-lg py-2.5 font-medium text-sm text-gray-700 hover:bg-gray-50 transition">
            {cancelLabel}
          </button>
          <button type="submit" className="flex-1 rounded-lg py-2.5 font-semibold text-sm text-white bg-brand-orange hover:bg-orange-600 transition">
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
