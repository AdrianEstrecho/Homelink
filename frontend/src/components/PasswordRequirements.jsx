import { Check, X } from 'lucide-react';
import { passwordRules } from '../utils/password';

export default function PasswordRequirements({ password }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-1.5">
      {passwordRules.map(rule => {
        const met = rule.test(password || '');
        return (
          <li key={rule.key} className={`flex items-center gap-1.5 ${met ? 'text-green-600' : 'text-gray-400'}`}>
            {met ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
