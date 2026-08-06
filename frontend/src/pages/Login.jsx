import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { LogIn, Lock, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePageTransition } from '../context/PageTransitionContext';
import AuthLayout from '../components/AuthLayout';
import AuthIllustration from '../components/AuthIllustration';
import AppleSignInButton, { isAppleSignInConfigured } from '../components/AppleSignInButton';

const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
const appleConfigured = isAppleSignInConfigured();

export default function Login() {
  const { login, logout, loginWithGoogle, loginWithApple } = useAuth();
  // Same full-screen blue cover used when entering login from the homepage —
  // reused here so a successful sign-in gets the same ceremony, not just the
  // pre-auth navigation. It owns its own navigate() call, so this replaces
  // the old local fade-and-navigate.
  const coverTransitionTo = usePageTransition();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [notRegistered, setNotRegistered] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(form.email, form.password);
      if (user.role !== 'customer') {
        logout();
        throw new Error('Staff accounts sign in at the staff portal — press Ctrl+Alt+. to continue there.');
      }
      coverTransitionTo('/');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setNotRegistered(false);
    setLoading(true);
    try {
      await loginWithGoogle(credentialResponse.credential, { mode: 'login' });
      coverTransitionTo('/');
    } catch (err) {
      if (err.code === 'not_registered') {
        setNotRegistered(true);
      } else {
        setError(err.message || 'Google sign-in failed');
      }
      setLoading(false);
    }
  };

  const handleAppleSuccess = async (response) => {
    setError('');
    setLoading(true);
    try {
      await loginWithApple({
        identityToken: response.authorization?.id_token,
        firstName: response.user?.name?.firstName,
        lastName: response.user?.name?.lastName,
      });
      coverTransitionTo('/');
    } catch (err) {
      setError(err.message || 'Apple sign-in failed');
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Login"
      subtitle="Login to access your HomeLink account"
      illustration={<AuthIllustration icon={Lock} badgeIcon={ShieldCheck} />}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Password</label>
          <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input-field" />
          <div className="flex justify-end mt-1.5">
            <Link to="/forgot-password" className="text-xs text-brand-orange font-medium hover:underline">Forgot Password?</Link>
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-70 transition-opacity">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          {loading ? 'Signing in...' : 'Login'}
        </button>
        <p className="text-center text-sm text-gray-600">
          Don't have an account? <Link to="/register" className="text-brand-orange font-semibold hover:underline">Sign up</Link>
        </p>

        {(googleConfigured || appleConfigured) && (
          <>
            <div className="relative text-center pt-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <span className="relative bg-white px-3 text-xs text-gray-400 uppercase">Or login with</span>
            </div>
            <div className="space-y-3 flex flex-col items-center">
              {googleConfigured && (
                <div className="w-[320px] space-y-2">
                  <div className="rounded-lg overflow-hidden">
                    <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google sign-in failed')} width="320" />
                  </div>
                  {notRegistered && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <p>
                        We couldn't find a HomeLink account for this Google account.{' '}
                        <Link to="/register" className="font-semibold underline hover:text-amber-900">Register first</Link> to continue.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {appleConfigured && (
                <div className="w-[320px]">
                  <AppleSignInButton onSuccess={handleAppleSuccess} onError={(msg) => setError(msg)} label="Sign in with Apple" />
                </div>
              )}
            </div>
          </>
        )}

      </form>
    </AuthLayout>
  );
}
