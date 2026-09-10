import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import AuthLayout from '../components/AuthLayout';
import AuthIllustration from '../components/AuthIllustration';

export default function VerifyResetCode() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  if (!email) {
    return (
      <AuthLayout title="Verify code" backTo="/login" illustration={<AuthIllustration icon={ShieldCheck} />}>
        <p className="text-sm text-gray-600">
          This verification session has expired. Please{' '}
          <Link to="/forgot-password" className="text-brand-orange font-semibold hover:underline">request a new code</Link> to reset your password.
        </p>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/verify-reset-code', { email, code });
      navigate('/reset-password', { state: { email, code } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResent(false);
    try {
      await api.post('/auth/forgot-password', { email });
      setResent(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <AuthLayout
      title="Verify code"
      subtitle="An authentication code has been sent to your email."
      backTo="/login"
      illustration={<AuthIllustration icon={ShieldCheck} />}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">Enter Code</label>
          <input
            required
            autoFocus
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            className="input-field tracking-widest font-mono uppercase"
            placeholder="XXXXXXXX"
          />
        </div>
        <p className="text-sm text-gray-600">
          Didn't receive a code?{' '}
          <button type="button" onClick={handleResend} className="text-brand-orange font-semibold hover:underline">Resend</button>
          {resent && <span className="text-green-600 ml-2">Sent!</span>}
        </p>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 disabled:opacity-50">
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </AuthLayout>
  );
}
