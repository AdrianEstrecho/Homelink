import { Link } from 'react-router-dom';
import { Home as HomeIcon, ChevronLeft } from 'lucide-react';
import AuthScene from './auth/AuthScene';

function Logo() {
  return (
    <Link to="/" className="inline-flex items-center gap-2 group w-fit">
      <div className="w-9 h-9 bg-brand-orange rounded-lg flex items-center justify-center group-hover:scale-105 transition">
        <HomeIcon className="w-5 h-5 text-white" />
      </div>
      <span className="font-display font-extrabold text-xl tracking-tight text-brand-navy">
        Home<span className="text-brand-orange">Link</span>
      </span>
    </Link>
  );
}

// `scene` is passed straight to AuthScene ({ level, success, flickerKey }).
// `caption` ({ title, body }) sits over the sky on the desktop panel only; on
// smaller screens the scene shrinks to a banner above the form instead.
export default function AuthLayout({ title, subtitle, backTo, backLabel = 'Back to login', scene = {}, caption, children }) {
  return (
    // overflow-x-clip (not -hidden) contains the sideways step slide on narrow
    // screens without turning this into a scroll container, which would break
    // the sticky scene panel.
    <div className="min-h-screen flex bg-white overflow-x-clip">
      <div className="w-full lg:w-1/2 flex flex-col px-4 sm:px-12 lg:px-16 py-6 sm:py-8">
        <Logo />
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-8 sm:py-10">
          <AuthScene {...scene} compact className="lg:hidden relative h-28 sm:h-36 rounded-2xl mb-7" />
          {backTo && (
            <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-navy mb-6 w-fit">
              <ChevronLeft className="w-4 h-4" /> {backLabel}
            </Link>
          )}
          <div className="mb-7 auth-rise">
            <h1 className="font-display text-3xl sm:text-[2.1rem] font-extrabold tracking-tight text-brand-ink">{title}</h1>
            {subtitle && <p className="text-gray-500 mt-2 leading-relaxed">{subtitle}</p>}
          </div>
          <div className="auth-rise" style={{ animationDelay: '70ms' }}>
            {children}
          </div>
        </div>
      </div>

      <aside className="hidden lg:block lg:w-1/2 lg:sticky lg:top-0 lg:h-screen p-4">
        <div className="relative h-full rounded-[28px] overflow-hidden">
          <AuthScene {...scene} className="absolute inset-0" />
          {caption && (
            <div className="relative max-w-lg p-10 xl:p-14 text-white">
              <p className="font-display text-3xl xl:text-4xl font-extrabold tracking-tight leading-[1.1] text-balance">{caption.title}</p>
              {caption.body && <p className="mt-4 max-w-sm text-white/70 leading-relaxed text-pretty">{caption.body}</p>}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
