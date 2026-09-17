import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

// "Resend code" with a cooldown measured from when the last code went out
// (`sentAt`, ms), so a burst of clicks can't fire a burst of emails. `onResend`
// should reject on failure — the page shows the error, this just resets.
export default function ResendCode({ sentAt, onResend, cooldownSeconds = 30 }) {
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Clamped because `now` can lag a freshly updated sentAt by up to a tick.
  const remaining = Math.min(cooldownSeconds, Math.max(0, Math.ceil((sentAt + cooldownSeconds * 1000 - now) / 1000)));

  const handleResend = async () => {
    setSending(true);
    setResent(false);
    try {
      await onResend();
      setResent(true);
      setNow(Date.now());
    } catch {
      // Surfaced by the page's own error alert.
    } finally {
      setSending(false);
    }
  };

  return (
    <p className="text-sm text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1" aria-live="polite">
      <span>Didn't get it? Check your spam folder, or</span>
      {remaining > 0 ? (
        <span className="tabular-nums text-gray-400">resend in {remaining}s</span>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={sending}
          className="font-semibold text-brand-orange hover:underline disabled:opacity-60"
        >
          {sending ? 'Sending…' : 'resend the code'}
        </button>
      )}
      {resent && remaining > 0 && (
        <span className="auth-pop inline-flex items-center gap-1 font-medium text-teal-700">
          <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> New code sent
        </span>
      )}
    </p>
  );
}
