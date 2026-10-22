import { useState } from 'react';
import { CheckCircle2, CloudOff, Loader2, RotateCw, WifiOff } from 'lucide-react';
import { useServerStatus, checkNow } from '../api/serverStatus';

// Site-wide notice for when HomeLink's server can't be reached or is slow to answer (see
// api/serverStatus.js). Bottom of the screen, clear of the navbar and the toasts at the top; on
// phones it stops short of the assistant mascot in the bottom-right corner.
const VARIANTS = {
  offline: {
    icon: WifiOff,
    tone: 'bg-gray-100 text-gray-600',
    title: "You're offline",
    body: 'Check your internet connection, then try again.',
    role: 'alert',
  },
  down: {
    icon: CloudOff,
    tone: 'bg-red-50 text-red-500',
    title: 'HomeLink is temporarily unavailable',
    body: "We can't reach our server right now. This page will reconnect on its own as soon as it's back.",
    role: 'alert',
  },
  slow: {
    icon: Loader2,
    spin: true,
    tone: 'bg-brand-orange/10 text-brand-orange',
    title: 'Taking longer than usual',
    body: 'The server may be waking up or busy. This can take up to a minute — please don’t refresh.',
    role: 'status',
  },
  recovered: {
    icon: CheckCircle2,
    tone: 'bg-brand-teal/15 text-brand-teal',
    title: "You're back online",
    body: 'HomeLink is reachable again.',
    role: 'status',
  },
};

export default function ServiceStatusBanner() {
  const { offline, down, slow, recovered } = useServerStatus();
  const [retrying, setRetrying] = useState(false);

  const kind = offline ? 'offline' : down ? 'down' : slow ? 'slow' : recovered ? 'recovered' : null;
  if (!kind) return null;
  const { icon: Icon, spin, tone, title, body, role } = VARIANTS[kind];

  const retry = async () => {
    setRetrying(true);
    await checkNow();
    setRetrying(false);
  };

  return (
    <div
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      className="fixed z-[310] bottom-3 left-3 right-[5.25rem] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:bottom-5 sm:w-[28rem]"
    >
      {/* toast-in animates transform, so it goes on this inner panel: on the outer element it
          would override the -translate-x-1/2 that centers the banner. */}
      <div className="toast-in modal-panel p-3.5 sm:p-4 flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
          <Icon className={`w-[18px] h-[18px] ${spin ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold text-brand-ink">{title}</p>
          <p className="text-sm text-gray-500 mt-0.5">{body}</p>
          {kind === 'down' && (
            <button
              type="button"
              onClick={retry}
              disabled={retrying}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-navy hover:text-brand-orange transition disabled:opacity-60"
            >
              <RotateCw className={`w-4 h-4 ${retrying ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
              {retrying ? 'Checking…' : 'Try again'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
