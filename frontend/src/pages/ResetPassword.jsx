import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, KeyRound } from 'lucide-react';
import { api } from '../api/client';
import PasswordRequirements from '../components/PasswordRequirements';
import { isPasswordValid, passwordRules } from '../utils/password';
import AuthLayout from '../components/AuthLayout';
import { PasswordField } from '../components/auth/AuthField';
import FormAlert from '../components/auth/FormAlert';
import SubmitButton from '../components/auth/SubmitButton';
import { RESET_CAPTION } from '../data/authCaptions';

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const { email, code } = location.state || {};

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const rulesMet = passwordRules.filter(rule => rule.test(password)).length;
  // Picks up where the code step left off (four windows lit) and finishes the house.
  const level = (4 + (rulesMet / passwordRules.length) + (passwordsMatch ? 1 : 0)) / 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!isPasswordValid(password)) errs.password = 'Your password needs to meet every requirement below.';
    if (!confirmPassword) errs.confirmPassword = 'Re-enter your password.';
    else if (!passwordsMatch) errs.confirmPassword = "Passwords don't match.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      setErrorKey(k => k + 1);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { email, code, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
      setErrorKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  };

  if (!email || !code) {
    return (
      <AuthLayout title="Choose a new password" backTo="/login" caption={RESET_CAPTION}>
        <p className="text-sm text-gray-600">
          This reset session has expired.{' '}
          <Link to="/forgot-password" className="text-brand-orange font-semibold hover:underline">Request a new code</Link> to reset your password.
        </p>
      </AuthLayout>
    );
  }

  const scene = { level, success: done, flickerKey: errorKey };

  if (done) {
    return (
      <AuthLayout title="Password updated" scene={scene} caption={RESET_CAPTION}>
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl bg-brand-teal/10 px-4 py-3.5 text-brand-navy">
            <CheckCircle2 className="auth-pop w-5 h-5 mt-0.5 shrink-0 text-teal-700" />
            <p className="text-sm">Your password for <span className="font-semibold">{email}</span> has been changed. Sign in with your new password.</p>
          </div>
          <button onClick={() => navigate('/login')} className="btn-primary group w-full flex items-center justify-center gap-2 py-3">
            Sign in <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Your reset code checked out. Pick a new password for your account."
      scene={scene}
      caption={RESET_CAPTION}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <PasswordField
            id="reset-password"
            label="New password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFieldErrors(fe => ({ ...fe, password: undefined })); }}
            error={fieldErrors.password}
          />
          <PasswordRequirements password={password} />
        </div>
        <PasswordField
          id="reset-confirm-password"
          label="Confirm new password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(fe => ({ ...fe, confirmPassword: undefined })); }}
          error={fieldErrors.confirmPassword}
          hint={passwordsMatch ? (
            <span className="inline-flex items-center gap-1 font-medium text-teal-700">
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Passwords match
            </span>
          ) : undefined}
        />
        <FormAlert key={errorKey}>{error}</FormAlert>
        <SubmitButton loading={loading} icon={KeyRound} loadingLabel="Saving…">
          Save new password
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
