import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import { api } from '../api/client';
import AuthLayout from '../components/AuthLayout';
import AuthIllustration from '../components/AuthIllustration';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      navigate('/verify-reset-code', { state: { email } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Don't worry, happens to all of us. Enter your email below to recover your password"
      backTo="/login"
      illustration={<AuthIllustration icon={KeyRound} badgeIcon={Mail} />}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} className="input-field" />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50">
          <KeyRound className="w-4 h-4" /> {loading ? 'Sending...' : 'Submit'}
        </button>
      </form>
    </AuthLayout>
  );
}
