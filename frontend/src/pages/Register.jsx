import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { ArrowRight, Check, ChevronLeft, MailCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import PasswordRequirements from '../components/PasswordRequirements';
import { isPasswordValid, passwordRules } from '../utils/password';
import { isEmailValid } from '../utils/validation';
import AuthLayout from '../components/AuthLayout';
import { AuthField, PasswordField } from '../components/auth/AuthField';
import CodeInput from '../components/auth/CodeInput';
import FormAlert from '../components/auth/FormAlert';
import ResendCode from '../components/auth/ResendCode';
import SubmitButton from '../components/auth/SubmitButton';
import TermsModal from '../components/TermsModal';
import useAuthSuccess from '../hooks/useAuthSuccess';

const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
const CODE_LENGTH = 8;

// The verification code is emailed when leaving step 1, so it's already
// waiting in the inbox by the time the password step is done. The code is
// only checked server-side by /auth/register, which is why entering it is the
// last step: a wrong code fails right where it was typed.
const STEPS = [
  { key: 'details', label: 'Your details' },
  { key: 'password', label: 'Password' },
  { key: 'verify', label: 'Verify email' },
];

const CAPTION = {
  title: "Let's get the lights on.",
  body: 'One account to shop CCTV, aircon, solar and smart-home gear — and book the technicians who install it.',
};

function StepIndicator({ step, progress, onSelect }) {
  return (
    <ol className="grid grid-cols-3 gap-2 mb-7" aria-label="Sign-up steps">
      {STEPS.map((s, i) => {
        const done = i < step;
        const current = i === step;
        // The current step's bar tracks how much of that step is filled in.
        const width = done ? 100 : current ? Math.max(8, progress[i] * 100) : 0;
        return (
          <li key={s.key} className="min-w-0">
            <button
              type="button"
              onClick={() => onSelect(i)}
              disabled={!done}
              aria-current={current ? 'step' : undefined}
              className="group w-full text-left disabled:cursor-default"
            >
              <span className="block h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <span
                  className={`block h-full rounded-full transition-all duration-500 ease-out ${done ? 'bg-brand-teal' : 'bg-brand-orange'}`}
                  style={{ width: `${width}%` }}
                />
              </span>
              <span
                className={`mt-2 flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                  current ? 'text-brand-ink' : done ? 'text-teal-700 group-hover:text-brand-navy' : 'text-gray-400'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} /> : <span className="tabular-nums">{i + 1}</span>}
                <span className="truncate">{s.label}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export default function Register() {
  const { register, loginWithGoogle } = useAuth();
  // Lights the scene fully, then hands off to the same full-screen cover the
  // homepage Login button and Login page success use.
  const { succeeded, finish } = useAuthSuccess();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState('forward');
  // Fields only autofocus after moving between steps, not on first load —
  // otherwise phones pop the keyboard open over the page straight away.
  const [navigated, setNavigated] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '', code: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [codeSentTo, setCodeSentTo] = useState('');
  const [codeSentAt, setCodeSentAt] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  // Bumped on every failed attempt: replays the alert shake and flickers the scene.
  const [errorKey, setErrorKey] = useState(0);
  const [loading, setLoading] = useState(false);

  const emailValid = isEmailValid(form.email);
  const normalizedEmail = form.email.trim().toLowerCase();
  const passwordsMatch = form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  const progress = [
    [form.firstName.trim(), form.lastName.trim(), emailValid].filter(Boolean).length / 3,
    (passwordRules.filter(rule => rule.test(form.password)).length + (passwordsMatch ? 1 : 0) + (acceptedTerms ? 1 : 0)) / (passwordRules.length + 2),
    form.code.length / CODE_LENGTH,
  ];
  // Details and password light two windows each, the code a fifth; creating the account lights the last.
  const level = (progress[0] * 2 + progress[1] * 2 + progress[2]) / 6;

  const fail = (message) => {
    setError(message);
    setErrorKey(k => k + 1);
  };

  const rejectFields = (errs) => {
    setFieldErrors(errs);
    setErrorKey(k => k + 1);
  };

  const updateField = (field) => (e) => {
    const { value } = e.target;
    setForm(f => ({ ...f, [field]: value }));
    setFieldErrors(fe => ({ ...fe, [field]: undefined }));
  };

  const goTo = (index) => {
    setDirection(index > step ? 'forward' : 'back');
    setStep(index);
    setNavigated(true);
    setError('');
    setFieldErrors({});
  };

  // Checking the box doesn't accept on its own — it opens the terms for the user to actually
  // read; only the modal's Accept button (after they've scrolled through it) sets acceptedTerms.
  const handleTermsCheckboxChange = (e) => {
    if (e.target.checked) setShowTerms(true);
    else setAcceptedTerms(false);
  };
  const handleAcceptTerms = () => {
    setAcceptedTerms(true);
    setShowTerms(false);
    setFieldErrors(fe => ({ ...fe, terms: undefined }));
  };
  const handleDeclineTerms = () => {
    setAcceptedTerms(false);
    setShowTerms(false);
  };

  const submitDetails = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'Enter your first name.';
    if (!form.lastName.trim()) errs.lastName = 'Enter your last name.';
    if (!form.email.trim()) errs.email = 'Enter your email.';
    else if (!emailValid) errs.email = 'Enter a valid email, like name@example.com.';
    if (Object.keys(errs).length) {
      rejectFields(errs);
      return;
    }

    // Coming back to this step without changing the email: the code already
    // sent is still good, and sending another would invalidate it.
    if (codeSentTo === normalizedEmail) {
      goTo(1);
      return;
    }

    setSendingCode(true);
    setError('');
    try {
      await api.post('/auth/send-verification-code', { email: form.email });
      setCodeSentTo(normalizedEmail);
      setCodeSentAt(Date.now());
      setForm(f => ({ ...f, code: '' }));
      goTo(1);
    } catch (err) {
      if (/already registered/i.test(err.message)) {
        rejectFields({
          email: (
            <>
              This email already has a HomeLink account.{' '}
              <Link to="/login" className="font-semibold underline">Sign in instead</Link>
            </>
          ),
        });
      } else {
        fail(err.message);
      }
    } finally {
      setSendingCode(false);
    }
  };

  const submitPassword = (e) => {
    e.preventDefault();
    const errs = {};
    if (!isPasswordValid(form.password)) errs.password = 'Your password needs to meet every requirement below.';
    if (!form.confirmPassword) errs.confirmPassword = 'Re-enter your password.';
    else if (!passwordsMatch) errs.confirmPassword = "Passwords don't match.";
    if (!acceptedTerms) errs.terms = 'Read and accept the Terms & Conditions to continue.';
    if (Object.keys(errs).length) {
      rejectFields(errs);
      return;
    }
    goTo(2);
  };

  const createAccount = async (code) => {
    if (loading || succeeded) return;
    if (code.length < CODE_LENGTH) {
      rejectFields({ code: `Enter all ${CODE_LENGTH} characters of the code.` });
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register({ ...form, code, acceptedTerms });
      finish('/');
    } catch (err) {
      fail(err.message);
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError('');
    try {
      await api.post('/auth/send-verification-code', { email: form.email });
      setCodeSentAt(Date.now());
    } catch (err) {
      fail(err.message);
      throw err;
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const result = await loginWithGoogle(credentialResponse.credential);
      if (result.requires2FA) {
        fail('This Google account already has a HomeLink account with two-factor authentication on. Sign in from the Login page instead.');
        setLoading(false);
        return;
      }
      finish('/');
    } catch (err) {
      fail(err.message || 'Google sign-up failed. Try again, or sign up with your email.');
      setLoading(false);
    }
  };

  const subtitles = [
    'Shop home products and book installers with one account.',
    'Choose a password you’ll use to sign in.',
    <>Enter the {CODE_LENGTH}-character code we sent to <span className="font-semibold text-brand-ink">{codeSentTo}</span>.</>,
  ];

  const backButton = (to) => (
    <button
      type="button"
      onClick={() => goTo(to)}
      className="inline-flex items-center gap-1 px-4 py-3 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-brand-navy transition"
    >
      <ChevronLeft className="w-4 h-4" /> Back
    </button>
  );

  return (
    <AuthLayout
      title="Create your account"
      subtitle={subtitles[step]}
      scene={{ level, success: succeeded, flickerKey: errorKey }}
      caption={CAPTION}
    >
      <StepIndicator step={step} progress={progress} onSelect={goTo} />

      <div key={step} className={direction === 'forward' ? 'auth-step-forward' : 'auth-step-back'}>
        {step === 0 && (
          <>
            <form onSubmit={submitDetails} noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <AuthField
                  id="signup-first-name"
                  label="First name"
                  autoComplete="given-name"
                  autoFocus={navigated}
                  value={form.firstName}
                  onChange={updateField('firstName')}
                  error={fieldErrors.firstName}
                />
                <AuthField
                  id="signup-last-name"
                  label="Last name"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={updateField('lastName')}
                  error={fieldErrors.lastName}
                />
              </div>
              <AuthField
                id="signup-email"
                label="Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={form.email}
                onChange={updateField('email')}
                valid={emailValid}
                error={fieldErrors.email}
                hint="We'll send a code here to confirm it's yours."
              />
              <AuthField
                id="signup-phone"
                label="Phone number"
                labelAside={<span className="text-xs text-gray-400">Optional</span>}
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="0917 123 4567"
                value={form.phone}
                onChange={updateField('phone')}
                hint="For delivery and technician visit updates."
              />
              <FormAlert key={errorKey}>{error}</FormAlert>
              <SubmitButton loading={sendingCode} icon={ArrowRight} loadingLabel="Sending code…">
                Continue
              </SubmitButton>
            </form>

            {googleConfigured && (
              <>
                <div className="flex items-center gap-3 my-6 text-xs font-medium uppercase tracking-wider text-gray-400">
                  <span className="h-px flex-1 bg-gray-200" /> or <span className="h-px flex-1 bg-gray-200" />
                </div>
                <div className="flex justify-center">
                  <div className="w-[320px] max-w-full rounded-lg overflow-hidden">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => fail('Google sign-up failed. Try again, or sign up with your email.')}
                      text="signup_with"
                      width="320"
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {step === 1 && (
          <form onSubmit={submitPassword} noValidate className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl bg-brand-teal/10 px-3.5 py-3 text-sm text-brand-navy">
              <MailCheck className="w-4 h-4 mt-0.5 shrink-0 text-teal-700" />
              <p>
                Code sent to <span className="font-semibold">{codeSentTo}</span>. You'll enter it in the next step.
              </p>
            </div>
            <div>
              <PasswordField
                id="signup-password"
                label="Password"
                autoComplete="new-password"
                autoFocus
                value={form.password}
                onChange={updateField('password')}
                error={fieldErrors.password}
              />
              <PasswordRequirements password={form.password} />
            </div>
            <PasswordField
              id="signup-confirm-password"
              label="Confirm password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={updateField('confirmPassword')}
              error={fieldErrors.confirmPassword}
              hint={
                passwordsMatch ? (
                  <span className="inline-flex items-center gap-1 font-medium text-teal-700">
                    <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Passwords match
                  </span>
                ) : form.confirmPassword.length >= form.password.length && form.confirmPassword ? (
                  <span className="text-red-600">Passwords don't match yet.</span>
                ) : undefined
              }
            />

            <div className="pt-1">
              <label className="flex items-start gap-2.5 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={handleTermsCheckboxChange}
                  aria-invalid={fieldErrors.terms ? true : undefined}
                  aria-describedby={fieldErrors.terms ? 'signup-terms-error' : undefined}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-brand-orange cursor-pointer"
                />
                <span>
                  I've read and agree to the{' '}
                  <button type="button" onClick={() => setShowTerms(true)} className="text-brand-orange font-semibold hover:underline">
                    Terms &amp; Conditions
                  </button>{' '}
                  and Privacy Policy.
                </span>
              </label>
              {fieldErrors.terms && <p id="signup-terms-error" className="mt-1.5 ml-6 text-xs text-red-600">{fieldErrors.terms}</p>}
            </div>

            <FormAlert key={errorKey}>{error}</FormAlert>
            <div className="flex gap-3">
              {backButton(0)}
              <SubmitButton icon={ArrowRight} className="flex-1">Continue</SubmitButton>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); createAccount(form.code); }} noValidate className="space-y-5">
            <div>
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <p id="signup-code-label" className="text-sm font-medium text-brand-ink">Verification code</p>
                <button type="button" onClick={() => goTo(0)} className="text-xs font-semibold text-brand-orange hover:underline">
                  Use a different email
                </button>
              </div>
              <CodeInput
                id="signup-code"
                labelledBy="signup-code-label"
                describedBy={fieldErrors.code ? 'signup-code-error' : undefined}
                value={form.code}
                onChange={(code) => {
                  setForm(f => ({ ...f, code }));
                  setFieldErrors({});
                  if (error) setError('');
                }}
                onComplete={createAccount}
                invalid={Boolean(fieldErrors.code || error)}
                disabled={loading || succeeded}
                autoFocus
              />
              {fieldErrors.code && <p id="signup-code-error" className="mt-2 text-xs text-red-600">{fieldErrors.code}</p>}
            </div>
            <ResendCode sentAt={codeSentAt} onResend={resendCode} />
            <FormAlert key={errorKey}>{error}</FormAlert>
            <div className="flex gap-3">
              {!succeeded && backButton(1)}
              <SubmitButton
                loading={loading}
                success={succeeded}
                icon={UserPlus}
                loadingLabel="Creating account…"
                successLabel="Account created"
                className="flex-1"
              >
                Create account
              </SubmitButton>
            </div>
          </form>
        )}
      </div>

      <p className="text-center text-sm text-gray-600 mt-7">
        Already have an account? <Link to="/login" className="text-brand-orange font-semibold hover:underline">Sign in</Link>
      </p>

      <TermsModal
        open={showTerms}
        onClose={() => setShowTerms(false)}
        onAccept={handleAcceptTerms}
        onDecline={handleDeclineTerms}
      />
    </AuthLayout>
  );
}
