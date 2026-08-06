import { Link } from 'react-router-dom';
import { Home as HomeIcon, ChevronLeft } from 'lucide-react';

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

export default function AuthLayout({ title, subtitle, backTo, backLabel = 'Back to login', illustration, children }) {
  return (
    <div className="min-h-screen flex bg-white">
      <div className="w-full lg:w-1/2 flex flex-col px-6 sm:px-12 lg:px-16 py-8">
        <Logo />
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-10">
          {backTo && (
            <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-navy mb-6 w-fit">
              <ChevronLeft className="w-4 h-4" /> {backLabel}
            </Link>
          )}
          <div className="mb-7">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-brand-ink">{title}</h1>
            {subtitle && <p className="text-gray-500 mt-2">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
      <div className="hidden lg:flex w-1/2 items-center justify-center bg-brand-light/40 p-10">
        {illustration}
      </div>
    </div>
  );
}
