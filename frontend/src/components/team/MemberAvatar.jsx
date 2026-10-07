import SafeImage from '../SafeImage';
import { initialsOf } from '../../data/team';

// A team member's photo when one is set in data/team.js, otherwise their initials on their own
// gradient. Decorative either way — every place it's used prints the name right beside it.
export default function MemberAvatar({ member, className = '', textClassName = 'text-xl' }) {
  if (member.photo) {
    return <SafeImage src={member.photo} alt="" className={`object-cover ${className}`} iconClassName="w-6 h-6" />;
  }
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center bg-gradient-to-br ${member.gradient} font-display font-extrabold tracking-tight text-white select-none ${className}`}
    >
      <span className={textClassName}>{initialsOf(member)}</span>
    </span>
  );
}
