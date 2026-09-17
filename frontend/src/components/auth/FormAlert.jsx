import { AlertCircle } from 'lucide-react';

const TONES = {
  error: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
};

// Give it a new `key` on each failed attempt so the shake replays even when
// the message text is the same as last time.
export default function FormAlert({ tone = 'error', children }) {
  if (!children) return null;
  return (
    <div role="alert" className={`auth-shake flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${TONES[tone]}`}>
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
