import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import SafeImage from './SafeImage';

function Toast({ toast, onDismiss }) {
  const { icon: Icon, iconClass = 'bg-brand-teal/15 text-brand-teal', image, title, description, action, duration } = toast;

  return (
    <div className="toast-in pointer-events-auto w-[calc(100vw-2rem)] sm:w-96 modal-panel p-4 flex items-start gap-3 overflow-hidden relative">
      {image ? (
        <SafeImage src={image} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0 bg-gray-100" iconClassName="w-5 h-5" />
      ) : Icon ? (
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      ) : null}

      <div className="min-w-0 flex-1 pt-0.5">
        {title && <p className="text-sm font-semibold text-brand-ink">{title}</p>}
        {description && <p className="text-sm text-gray-500 mt-0.5 truncate">{description}</p>}
        {action && (
          <Link to={action.to} onClick={() => onDismiss(toast.id)} className="inline-block mt-1.5 text-sm font-semibold text-brand-teal hover:underline">
            {action.label}
          </Link>
        )}
      </div>

      <button onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification" className="p-1 text-gray-400 hover:text-gray-600 transition shrink-0 -mt-1 -mr-1">
        <X className="w-4 h-4" />
      </button>

      <div className="toast-progress absolute bottom-0 left-0 h-0.5 bg-brand-orange/50" style={{ animationDuration: `${duration}ms` }} />
    </div>
  );
}

export default function ToastViewport({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed inset-x-0 top-0 sm:inset-x-auto sm:top-5 sm:right-5 z-[300] flex flex-col items-center sm:items-end gap-2.5 p-4 pointer-events-none">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  );
}
