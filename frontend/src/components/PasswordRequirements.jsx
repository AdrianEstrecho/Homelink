import { Check } from 'lucide-react';
import { passwordRules } from '../utils/password';

// A segmented meter (one segment per rule, teal once they're all met) above
// the checklist itself, so progress reads at a glance while typing.
export default function PasswordRequirements({ password }) {
  const results = passwordRules.map(rule => ({ ...rule, met: rule.test(password || '') }));
  const metCount = results.filter(r => r.met).length;
  const allMet = metCount === results.length;

  return (
    <div className="mt-3">
      <div className="flex gap-1.5" aria-hidden="true">
        {results.map((rule, i) => (
          <span
            key={rule.key}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i < metCount ? (allMet ? 'bg-brand-teal' : 'bg-brand-orange') : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mt-2.5">
        {results.map(rule => (
          <li key={rule.key} className={`flex items-center gap-1.5 transition-colors ${rule.met ? 'text-teal-700' : 'text-gray-500'}`}>
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                rule.met ? 'bg-brand-teal text-white scale-100' : 'bg-gray-100 text-transparent scale-90'
              }`}
            >
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
            {rule.label}
            <span className="sr-only">{rule.met ? '(done)' : '(not yet)'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
