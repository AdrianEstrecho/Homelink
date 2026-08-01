import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { KeyRound, Lock, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import PasswordRequirements from '../components/PasswordRequirements';
import { isPasswordValid } from '../utils/password';
import AuthLayout from '../components/AuthLayout';
import AuthIllustration from '../components/AuthIllustration';

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const { email, code } = location.state || {};

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid(password)) {
      setError('Password does not meet the requirements below.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, code, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!email || !code) {
    return (
      <AuthLayout title="Set a password" illustration={<AuthIllustration icon={KeyRound} />}>
        <p className="text-sm text-gray-600">
          This reset session has expired. Please{' '}
          <Link to="/forgot-password" className="text-brand-orange font-semibold hover:underline">request a new code</Link> to reset your password.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a password"
      subtitle={done ? undefined : 'Your previous password has been reset. Please set a new password for your account.'}
      illustration={<AuthIllustration icon={Lock} badgeIcon={KeyRound} />}
    >
      {done ? (
        <div className="space-y-4">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
          <p className="text-gray-700">Your password has been reset successfully.</p>
          <button onClick={() => navigate('/login')} className="btn-primary w-full py-3">Sign In</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">Create Password</label>
            <input
              type="password"
              required
              autoFocus
              value={password}
              onFocus={() => setPasswordTouched(true)}
              onChange={e => setPassword(e.target.value)}
              className="input-field"
            />
            {passwordTouched && <PasswordRequirements password={password} />}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Re-enter Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="input-field"
            />
            {!passwordsMatch && <p className="text-red-600 text-xs mt-1">Passwords do not match</p>}
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50">
            <KeyRound className="w-4 h-4" /> {loading ? 'Setting...' : 'Set password'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
