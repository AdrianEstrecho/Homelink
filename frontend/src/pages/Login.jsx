import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { ArrowRight, ChevronLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import { AuthField, PasswordField } from '../components/auth/AuthField';
import CodeInput from '../components/auth/CodeInput';
import FormAlert from '../components/auth/FormAlert';
import ResendCode from '../components/auth/ResendCode';
import SubmitButton from '../components/auth/SubmitButton';
import useAuthSuccess from '../hooks/useAuthSuccess';
import { isEmailValid } from '../utils/validation';

const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
const CODE_LENGTH = 8;

const CAPTION = {
  title: 'Lights on. Welcome home.',
  body: 'Your orders, installation bookings and saved addresses are right where you left them.',
};

export default function Login() {
  const { login, verifyTwoFactor, logout, loginWithGoogle } = useAuth();
  // Lights the scene fully, then hands off to the same full-screen blue cover
  // used when entering login from the homepage.
  const { succeeded, finish } = useAuthSuccess();
  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [stage, setStage] = useState('credentials'); // 'credentials' | '2fa'
  const [code, setCode] = useState('');
  const [codeSentAt, setCodeSentAt] = useState(0);
  const [error, setError] = useState('');
  // Bumped on every failed attempt: replays the alert shake and flickers the scene.
  const [errorKey, setErrorKey] = useState(0);
  const [notRegistered, setNotRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  // Set only when the pending 2FA challenge came from Google sign-in (no password on hand
  // to resend with in that case) — Google's ID token stays valid for reuse within its window.
  const [googleCredential, setGoogleCredential] = useState(null);

  const emailValid = isEmailValid(form.email);

  // Credentials can light up to four windows (two for the email, two for the
  // password), the 2FA code a fifth, and signing in lights the last.
  const emailScore = emailValid ? 1 : form.email.includes('@') ? 0.5 : 0;
  const passwordScore = Math.min(form.password.length / 8, 1);
  const level = stage === '2fa'
    ? (4 + code.length / CODE_LENGTH) / 6
    : (emailScore * 2 + passwordScore * 2) / 6;

  const fail = (message) => {
    setError(message);
    setErrorKey(k => k + 1);
  };

  const updateField = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setFieldErrors(fe => ({ ...fe, [field]: undefined }));
  };

  const finishLogin = (user) => {
    if (user.role !== 'customer') {
      logout();
      throw new Error('Staff accounts sign in at the staff portal — press Ctrl+Alt+. to continue there.');
    }
    finish('/');
  };

  const startTwoFactor = () => {
    setStage('2fa');
    setCode('');
    setCodeSentAt(Date.now());
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.email.trim()) errs.email = 'Enter your email.';
    else if (!emailValid) errs.email = 'Enter a valid email, like name@example.com.';
    if (!form.password) errs.password = 'Enter your password.';
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      setErrorKey(k => k + 1);
      return;
    }

    setLoading(true);
    setError('');
    setNotRegistered(false);
    try {
      const result = await login(form.email, form.password);
      if (result.requires2FA) {
        startTwoFactor();
        return;
      }
      finishLogin(result.user);
    } catch (err) {
      fail(err.message);
      setLoading(false);
    }
  };

  const verifyCode = async (value) => {
    if (loading || succeeded) return;
    if (value.length < CODE_LENGTH) {
      fail(`Enter all ${CODE_LENGTH} characters of the code.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await verifyTwoFactor(form.email, value);
      finishLogin(user);
    } catch (err) {
      fail(err.message);
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    try {
      if (googleCredential) {
        await loginWithGoogle(googleCredential, { mode: 'login' });
      } else {
        await login(form.email, form.password);
      }
      setCodeSentAt(Date.now());
    } catch (err) {
      fail(err.message);
      throw err;
    }
  };

  const backToCredentials = () => {
    setStage('credentials');
    setCode('');
    setError('');
    setGoogleCredential(null);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setNotRegistered(false);
    setLoading(true);
    try {
      const result = await loginWithGoogle(credentialResponse.credential, { mode: 'login' });
      if (result.requires2FA) {
        setForm(f => ({ ...f, email: result.email }));
        setGoogleCredential(credentialResponse.credential);
        startTwoFactor();
        return;
      }
      finish('/');
    } catch (err) {
      if (err.code === 'not_registered') {
        setNotRegistered(true);
        setErrorKey(k => k + 1);
      } else {
        fail(err.message || 'Google sign-in failed. Try again, or sign in with your email.');
      }
      setLoading(false);
    }
  };

  const scene = { level, success: succeeded, flickerKey: errorKey };

  if (stage === '2fa') {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={<>Enter the {CODE_LENGTH}-character code we sent to <span className="font-semibold text-brand-ink">{form.email}</span>.</>}
        scene={scene}
        caption={CAPTION}
      >
        <form onSubmit={(e) => { e.preventDefault(); verifyCode(code); }} noValidate className="space-y-5">
          <div>
            <p id="login-code-label" className="text-sm font-medium text-brand-ink mb-2">Verification code</p>
            <CodeInput
              id="login-code"
              labelledBy="login-code-label"
              value={code}
              onChange={(next) => { setCode(next); if (error) setError(''); }}
              onComplete={verifyCode}
              invalid={Boolean(error)}
              disabled={loading || succeeded}
              autoFocus
            />
          </div>
          <ResendCode sentAt={codeSentAt} onResend={handleResendCode} />
          <FormAlert key={errorKey}>{error}</FormAlert>
          <SubmitButton loading={loading} success={succeeded} icon={ShieldCheck} loadingLabel="Verifying…" successLabel="You're in">
            Verify and sign in
          </SubmitButton>
          <button
            type="button"
            onClick={backToCredentials}
            className="w-full inline-flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-brand-navy"
          >
            <ChevronLeft className="w-4 h-4" /> Sign in with a different account
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to track your orders, manage bookings, and check out faster."
      scene={scene}
      caption={CAPTION}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <AuthField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={form.email}
          onChange={updateField('email')}
          valid={emailValid}
          error={fieldErrors.email}
        />
        <PasswordField
          id="login-password"
          label="Password"
          autoComplete="current-password"
          value={form.password}
          onChange={updateField('password')}
          error={fieldErrors.password}
          labelAside={
            <Link to="/forgot-password" className="text-xs font-semibold text-brand-orange hover:underline">
              Forgot password?
            </Link>
          }
        />
        <FormAlert key={errorKey}>{error}</FormAlert>
        <SubmitButton loading={loading} success={succeeded} icon={ArrowRight} loadingLabel="Signing in…" successLabel="You're in">
          Sign in
        </SubmitButton>
      </form>

      {googleConfigured && (
        <>
          <div className="flex items-center gap-3 my-6 text-xs font-medium uppercase tracking-wider text-gray-400">
            <span className="h-px flex-1 bg-gray-200" /> or <span className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-[320px] max-w-full rounded-lg overflow-hidden">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => fail('Google sign-in failed. Try again, or sign in with your email.')}
                width="320"
              />
            </div>
            {notRegistered && (
              <div className="w-full" key={errorKey}>
                <FormAlert tone="warning">
                  There's no HomeLink account for this Google account yet.{' '}
                  <Link to="/register" className="font-semibold underline hover:text-amber-900">Create one</Link> to continue.
                </FormAlert>
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-center text-sm text-gray-600 mt-7">
        New to HomeLink? <Link to="/register" className="text-brand-orange font-semibold hover:underline">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
