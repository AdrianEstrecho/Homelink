import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { UserPlus, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePageTransition } from '../context/PageTransitionContext';
import { api } from '../api/client';
import PasswordRequirements from '../components/PasswordRequirements';
import { isPasswordValid } from '../utils/password';
import AuthLayout from '../components/AuthLayout';
import AuthIllustration from '../components/AuthIllustration';
import TermsModal from '../components/TermsModal';

const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { register, loginWithGoogle } = useAuth();
  // Same full-screen cover the homepage Login button and Login page success
  // use — keeps signup finishing with the same ceremony as signing in.
  const coverTransitionTo = usePageTransition();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', phone: '', code: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resent, setResent] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const passwordsMatch = form.confirmPassword.length === 0 || form.password === form.confirmPassword;
  const emailValid = EMAIL_PATTERN.test(form.email);

  const handleConfirmEmail = async () => {
    setVerifyError('');
    if (!emailValid) {
      setVerifyError('Enter a valid email first.');
      return;
    }
    setSendingCode(true);
    try {
      await api.post('/auth/send-verification-code', { email: form.email });
      setCodeSent(true);
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setSendingCode(false);
    }
  };

  const handleResendCode = async () => {
    setVerifyError('');
    setResent(false);
    try {
      await api.post('/auth/send-verification-code', { email: form.email });
      setResent(true);
    } catch (err) {
      setVerifyError(err.message);
    }
  };

  const handleChangeEmail = () => {
    setCodeSent(false);
    setResent(false);
    setVerifyError('');
    setForm(f => ({ ...f, code: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!codeSent || !form.code.trim()) {
      setError('Please confirm your email and enter the verification code first.');
      return;
    }
    if (!isPasswordValid(form.password)) {
      setError('Password does not meet the requirements below.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!acceptedTerms) {
      setError('You must agree to the Terms & Conditions to create an account.');
      return;
    }

    setLoading(true);
    try {
      await register({ ...form, acceptedTerms });
      coverTransitionTo('/');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const result = await loginWithGoogle(credentialResponse.credential);
      if (result.requires2FA) {
        setError('This Google account already has a HomeLink account with two-factor authentication enabled. Please sign in from the Login page instead.');
        setLoading(false);
        return;
      }
      coverTransitionTo('/');
    } catch (err) {
      setError(err.message || 'Google sign-up failed');
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Sign up"
      subtitle="Let's get you all set up so you can access your personal account."
      illustration={<AuthIllustration icon={UserPlus} badgeIcon={ShieldCheck} />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">First Name</label>
            <input required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Last Name</label>
            <input required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="input-field" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <div className="flex gap-2">
            <input
              type="email"
              required
              disabled={codeSent}
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="input-field flex-1 disabled:bg-gray-50 disabled:text-gray-500"
            />
            {!codeSent && (
              <button
                type="button"
                onClick={handleConfirmEmail}
                disabled={sendingCode || !form.email}
                className="btn-secondary whitespace-nowrap px-4 disabled:opacity-50"
              >
                {sendingCode ? 'Sending...' : 'Confirm Email'}
              </button>
            )}
          </div>
          {codeSent && (
            <div className="mt-3">
              <label className="block text-sm font-medium mb-1.5">Verification Code</label>
              <input
                required
                autoFocus
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                maxLength={8}
                className="input-field tracking-widest font-mono uppercase"
                placeholder="XXXXXXXX"
              />
              <p className="text-xs text-gray-500 mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" /> Code sent to {form.email}.
                </span>
                <button type="button" onClick={handleResendCode} className="text-brand-orange font-semibold hover:underline">Resend</button>
                {resent && <span className="text-green-600">Sent!</span>}
                <span className="text-gray-300">&middot;</span>
                <button type="button" onClick={handleChangeEmail} className="text-brand-orange font-semibold hover:underline">Change email</button>
              </p>
            </div>
          )}
          {verifyError && <p className="text-red-600 text-xs mt-1.5">{verifyError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Phone Number</label>
          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Password</label>
          <input
            type="password"
            required
            value={form.password}
            onFocus={() => setPasswordTouched(true)}
            onChange={e => setForm({ ...form, password: e.target.value })}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
          <input
            type="password"
            required
            value={form.confirmPassword}
            onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
            className="input-field"
          />
        </div>
        {passwordTouched && <PasswordRequirements password={form.password} />}
        {!passwordsMatch && <p className="text-red-600 text-xs">Passwords do not match</p>}

        <label className="flex items-start gap-2 text-sm text-gray-600 pt-1">
          <input
            type="checkbox"
            required
            checked={acceptedTerms}
            onChange={e => setAcceptedTerms(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I agree to all the <button type="button" onClick={() => setShowTerms(true)} className="text-brand-orange font-semibold hover:underline">Terms</button> and Privacy Policies
          </span>
        </label>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading || !codeSent || !form.code.trim()} className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50">
          <UserPlus className="w-4 h-4" /> {loading ? 'Creating...' : 'Create account'}
        </button>
        <p className="text-center text-sm text-gray-600">
          Already have an account? <Link to="/login" className="text-brand-orange font-semibold hover:underline">Login</Link>
        </p>

        {googleConfigured && (
          <>
            <div className="relative text-center pt-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <span className="relative bg-white px-3 text-xs text-gray-400 uppercase">Or sign up with</span>
            </div>
            <div className="space-y-3 flex flex-col items-center">
              <div className="w-[320px] rounded-lg overflow-hidden">
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google sign-up failed')} text="signup_with" width="320" />
              </div>
            </div>
          </>
        )}
      </form>
      <TermsModal open={showTerms} onClose={() => setShowTerms(false)} />
    </AuthLayout>
  );
}
