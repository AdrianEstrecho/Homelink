import { ArrowUpRight } from 'lucide-react';
import MemberAvatar from './MemberAvatar';
import { fullNameOf } from '../../data/team';

const TILT = 8; // degrees at the card's edges

// One teammate on /team. Leans toward the pointer and glows in the member's own accent; the
// pointer position goes straight onto CSS variables (.team-card in index.css) rather than
// state, so tracking it never re-renders. Touch and pen get the glow but not the lean.
export default function MemberCard({ member, index, onOpen }) {
  const handleMove = (e) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty('--spot-x', `${x}px`);
    el.style.setProperty('--spot-y', `${y}px`);
    if (e.pointerType !== 'mouse') return;
    el.style.setProperty('--tilt-x', `${(0.5 - y / rect.height) * TILT}deg`);
    el.style.setProperty('--tilt-y', `${(x / rect.width - 0.5) * TILT}deg`);
  };

  const handleLeave = (e) => {
    e.currentTarget.style.setProperty('--tilt-x', '0deg');
    e.currentTarget.style.setProperty('--tilt-y', '0deg');
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      aria-haspopup="dialog"
      aria-label={`${fullNameOf(member)}, ${member.role}. View profile`}
      style={{ '--glow': `${member.color}47` }}
      className="team-card group relative flex flex-col w-full h-full text-left rounded-2xl border border-white/10 hover:border-white/25 bg-gradient-to-br from-white/[0.10] to-white/[0.03] p-4 sm:p-6 overflow-hidden"
    >
      <span className="team-card-glow" aria-hidden="true" />

      <span className="relative flex items-start justify-between gap-2">
        <MemberAvatar
          member={member}
          className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl shadow-lg shadow-black/20 transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-3"
          textClassName="text-lg sm:text-2xl"
        />
        <span className="font-display font-black tabular-nums text-sm text-white/20">.{String(index + 1).padStart(2, '0')}</span>
      </span>

      <span className="relative block mt-5 sm:mt-7">
        <span className="block font-display text-lg sm:text-xl font-bold leading-tight text-white">{member.firstName}</span>
        <span className="block mt-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] text-white/50">{member.lastName}</span>
      </span>

      <span className="relative flex items-center justify-between gap-2 mt-auto pt-5">
        <span className="badge bg-white/10 text-white/80">{member.role}</span>
        <ArrowUpRight className="w-4 h-4 shrink-0 text-white/40 transition duration-300 group-hover:text-brand-orange group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </button>
  );
}
