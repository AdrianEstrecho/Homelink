import { createPortal } from 'react-dom';
import { Home, Loader2 } from 'lucide-react';

// A deliberate, branded full-screen transition — distinct from the quick
// route-fade every other navigation gets (see App.jsx/index.css). Used for
// moments that deserve more ceremony, like entering the login flow from the
// homepage. `phase` is 'in' | 'out'; the parent unmounts this entirely once
// 'out' finishes. Keyed by phase in the parent so each stage is a fresh DOM
// node — a CSS animation (not a transition) on a freshly-mounted node always
// plays from its 0% keyframe, so the cover-in and cover-out are guaranteed to
// actually animate rather than risk collapsing into an instant jump.
// Portaled to <body> so callers nested inside a stacking-context ancestor
// (e.g. Navbar's sticky/z-50 bar) still get a true full-viewport cover.
export default function PageTransitionOverlay({ phase }) {
  return createPortal(
    <div
      className={`fixed inset-0 z-[500] flex items-center justify-center bg-gradient-to-br from-brand-navy via-brand-blue to-brand-navy ${
        phase === 'out' ? 'overlay-cover-out' : 'overlay-cover-in'
      }`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-5">
        <div className="w-16 h-16 bg-brand-orange rounded-2xl flex items-center justify-center shadow-xl">
          <Home className="w-8 h-8 text-white" />
        </div>
        <Loader2 className="w-7 h-7 text-white/80 animate-spin" />
      </div>
    </div>,
    document.body
  );
}
