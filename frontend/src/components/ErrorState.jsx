import { AlertTriangle, RotateCw } from 'lucide-react';

export default function ErrorState({ message = "Couldn't load this right now.", onRetry }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <p className="text-gray-600 text-sm mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy hover:text-brand-orange transition">
          <RotateCw className="w-4 h-4" /> Try again
        </button>
      )}
    </div>
  );
}
