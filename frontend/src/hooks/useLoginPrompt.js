import { LogIn } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export function useLoginPrompt() {
  const { showToast } = useToast();

  return (description) => {
    showToast({
      dedupeKey: 'login-required',
      icon: LogIn,
      iconClass: 'bg-brand-navy/10 text-brand-navy',
      title: 'Login required',
      description,
      action: { label: 'Log In', to: '/login' },
    });
  };
}
