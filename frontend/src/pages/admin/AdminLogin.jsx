import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck, LogIn, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { landingFor } from '../../utils/staffLanding';

export default function AdminLogin() {
  const { user, login, verifyTwoFactor, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [stage, setStage] = useState('credentials'); // 'credentials' | '2fa'
  const [code, setCode] = useState('');
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const existingLanding = user ? landingFor(user) : null;
  if (existingLanding) return <Navigate to={existingLanding} replace />;

  const finishLogin = (loggedIn) => {
    const landing = landingFor(loggedIn);
    if (landing) navigate(landing);
    else {
      logout();
      throw new Error('This portal is for staff use only.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await login(form.email, form.password);
      if (result.requires2FA) {
        setStage('2fa');
        return;
      }
      finishLogin(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const loggedIn = await verifyTwoFactor(form.email, code);
      finishLogin(loggedIn);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setResent(false);
    try {
      await login(form.email, form.password);
      setResent(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-navy via-[#0a1f42] to-black px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="float-blob absolute -top-24 -left-24 w-96 h-96 bg-brand-orange rounded-full blur-3xl" />
        <div className="float-blob-delayed absolute -bottom-24 -right-24 w-96 h-96 bg-brand-teal rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6 text-white/70 hover:text-white transition text-sm">
          <Home className="w-4 h-4" /> Back to site
        </Link>

        <div className="card overflow-hidden">
          <div className="bg-brand-navy px-8 py-8 text-center">
            <div className="w-14 h-14 mx-auto bg-brand-orange rounded-xl flex items-center justify-center mb-3">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">Home<span className="text-brand-orange">Link</span></h1>
            <p className="text-gray-300 text-sm mt-1 tracking-wide">STAFF PORTAL</p>
          </div>

          {stage === '2fa' ? (
            <form onSubmit={handleVerify2FA} className="p-8 space-y-5">
              <p className="text-sm text-gray-600">An authentication code has been sent to {form.email}.</p>
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
                <button type="button" onClick={handleResendCode} className="text-brand-orange font-semibold hover:underline">Resend</button>
                {resent && <span className="text-green-600 ml-2">Sent!</span>}
              </p>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-secondary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50">
                <LogIn className="w-4 h-4" /> {loading ? 'Verifying...' : 'Verify'}
              </button>
              <button type="button" onClick={() => { setStage('credentials'); setCode(''); setError(''); setResent(false); }} className="w-full text-center text-sm text-gray-500 hover:text-brand-navy">
                Back to login
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="input-field"
                  placeholder="you@homelink.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium">Password</label>
                  <Link to="/forgot-password" className="text-xs text-brand-orange font-medium hover:underline">Forgot password?</Link>
                </div>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="input-field"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-secondary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50">
                <LogIn className="w-4 h-4" /> {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">Restricted access &middot; Authorized personnel only</p>
      </div>
    </div>
  );
}
