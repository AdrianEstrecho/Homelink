import { Check, Loader2 } from 'lucide-react';

export default function SubmitButton({
  loading = false,
  success = false,
  disabled = false,
  icon: Icon,
  loadingLabel,
  successLabel,
  className = '',
  children,
}) {
  return (
    <button
      type="submit"
      disabled={loading || success || disabled}
      className={`btn-primary group w-full flex items-center justify-center gap-2 py-3 disabled:cursor-not-allowed ${
        success ? 'bg-brand-teal hover:bg-brand-teal' : 'disabled:opacity-60'
      } ${className}`}
    >
      {success ? (
        <>
          <Check className="auth-pop w-4 h-4" strokeWidth={3} /> {successLabel}
        </>
      ) : loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" /> {loadingLabel}
        </>
      ) : (
        <>
          {children}
          {Icon && <Icon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />}
        </>
      )}
    </button>
  );
}
