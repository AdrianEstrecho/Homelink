import { useRef } from 'react';
import { ArrowUpRight, Home } from 'lucide-react';
import MemberAvatar from './MemberAvatar';
import { fullNameOf } from '../../data/team';

const SWING = 7; // degrees at the badge's edges

// Barcode bars made from the slug, so every badge has its own code and it never changes.
function barcodeFor(slug) {
  const bars = [];
  let x = 0;
  for (const ch of slug.replace(/-/g, '')) {
    const code = ch.charCodeAt(0);
    const w = 1 + (code % 3);
    bars.push({ x, w });
    x += w + 1 + ((code >> 2) % 2);
  }
  return { bars, width: x };
}

// One teammate on /team, drawn as a HomeLink staff ID badge on a lanyard. It swings toward the
// pointer from where the lanyard hangs (the angle goes straight onto a CSS variable, so it never
// re-renders) and wobbles to rest when it first scrolls into view (.badge-* in index.css).
export default function MemberCard({ member, index, onOpen }) {
  const hangerRef = useRef(null);
  const { bars, width } = barcodeFor(member.slug);
  const number = String(index + 1).padStart(2, '0');

  const handleMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    hangerRef.current.style.setProperty('--swing', `${-x * SWING}deg`);
  };

  const handleLeave = () => {
    hangerRef.current.style.setProperty('--swing', '0deg');
  };

  return (
    <div className="badge-settle origin-top" style={{ animationDelay: `${index * 90}ms` }}>
      <div ref={hangerRef} className="badge-hanger flex flex-col items-center">
        <span aria-hidden="true" className="badge-strap block w-2.5 sm:w-3 h-9 sm:h-11" />
        <span aria-hidden="true" className="relative z-10 -mb-3.5 block w-6 sm:w-7 h-3.5 rounded-[4px] bg-gradient-to-b from-gray-100 to-gray-400 shadow ring-1 ring-black/10" />

        <button
          type="button"
          onClick={onOpen}
          onPointerMove={handleMove}
          onPointerLeave={handleLeave}
          aria-haspopup="dialog"
          aria-label={`${fullNameOf(member)}, ${member.role}. View profile`}
          className="badge-card group relative block w-full text-left rounded-2xl bg-white overflow-hidden"
        >
          <span className={`relative block h-[76px] sm:h-[88px] bg-gradient-to-br ${member.gradient}`}>
            <span aria-hidden="true" className="badge-grid absolute inset-0" />
            <span aria-hidden="true" className="absolute top-2.5 left-1/2 -translate-x-1/2 w-9 h-2 rounded-full bg-black/25 shadow-inner" />
            <span className="absolute top-6 sm:top-7 inset-x-0 flex items-center justify-center gap-1.5 text-white">
              <span className="w-4 h-4 rounded-[5px] bg-white/25 flex items-center justify-center">
                <Home className="w-2.5 h-2.5" strokeWidth={2.5} />
              </span>
              <span className="font-display text-[11px] font-extrabold tracking-tight">HomeLink</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/75">Dev</span>
            </span>
            <span aria-hidden="true" className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center transition duration-300 group-hover:bg-white group-hover:text-brand-navy">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </span>

          <span className="relative block -mt-8 sm:-mt-10 px-3 sm:px-4 pb-3.5 sm:pb-4 text-center">
            <MemberAvatar
              member={member}
              className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ring-4 ring-white shadow-lg transition-transform duration-500 group-hover:scale-105"
              textClassName="text-xl sm:text-2xl"
            />
            <span className="block mt-3 font-display text-base sm:text-lg font-extrabold leading-tight text-brand-ink">{member.firstName}</span>
            <span className="block mt-0.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{member.lastName}</span>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: member.color }} />
              {member.role}
            </span>
            <span className="mt-3.5 pt-3 flex items-center justify-between gap-2 border-t border-dashed border-gray-200">
              <span className="font-mono text-[10px] tracking-wider text-gray-400">HL-DEV-{number}</span>
              <svg aria-hidden="true" viewBox={`0 0 ${width} 14`} className="h-3.5 w-auto text-brand-ink/70">
                {bars.map(b => <rect key={b.x} x={b.x} width={b.w} height="14" fill="currentColor" />)}
              </svg>
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
