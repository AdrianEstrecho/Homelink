import { ShieldCheck } from 'lucide-react';

export default function AuthIllustration({ icon: Icon, badgeIcon: BadgeIcon = ShieldCheck }) {
  return (
    <div className="relative w-full max-w-md aspect-[4/5] rounded-[2rem] bg-gradient-to-br from-brand-light to-white border border-gray-100 shadow-inner overflow-hidden flex items-center justify-center">
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-brand-orange/10 rounded-full blur-2xl float-blob" />
      <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-brand-navy/10 rounded-full blur-2xl float-blob-delayed" />

      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-7 w-56 -rotate-3 hover:rotate-0 transition-transform duration-500">
        <div className="w-11 h-11 rounded-xl bg-brand-navy flex items-center justify-center mb-5">
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="space-y-2.5">
          <div className="h-2.5 w-3/4 rounded-full bg-gray-100" />
          <div className="h-8 rounded-lg bg-gray-50 border border-gray-100" />
          <div className="h-2.5 w-1/2 rounded-full bg-gray-100 mt-3" />
          <div className="h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center px-2.5 gap-1">
            {[...Array(4)].map((_, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
            ))}
          </div>
        </div>

        <div className="absolute -top-4 -right-4 w-11 h-11 rounded-full bg-brand-teal shadow-lg flex items-center justify-center ring-4 ring-white">
          <BadgeIcon className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        <span className="w-6 h-1.5 rounded-full bg-brand-orange" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
      </div>
    </div>
  );
}
