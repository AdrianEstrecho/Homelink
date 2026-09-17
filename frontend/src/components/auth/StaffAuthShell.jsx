import { Link } from 'react-router-dom';
import { ShieldCheck, Home } from 'lucide-react';

// The dark "Staff Portal" backdrop and branded card shared by the staff sign-in and
// password-reset pages — children render as the card's body.
export default function StaffAuthShell({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-navy via-[#0a1f42] to-black px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="float-blob absolute -top-24 -left-24 w-96 h-96 bg-brand-orange rounded-full blur-3xl" />
        <div className="float-blob-delayed absolute -bottom-24 -right-24 w-96 h-96 bg-brand-teal rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6 text-white/70 hover:text-white transition text-sm">
          <Home className="w-4 h-4" /> Back to site
        </Link>

        <div className="card overflow-hidden">
          <div className="bg-brand-navy px-8 py-8 text-center">
            <div className="w-14 h-14 mx-auto bg-brand-orange rounded-xl flex items-center justify-center mb-3">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">Home<span className="text-brand-orange">Link</span></h1>
            <p className="text-gray-300 text-sm mt-1 tracking-wide">STAFF PORTAL</p>
          </div>
          {children}
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">Restricted access &middot; Authorized personnel only</p>
      </div>
    </div>
  );
}
