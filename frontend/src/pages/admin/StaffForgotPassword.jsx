import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Send, KeyRound, CheckCircle2, Clock, ArrowRight, Check } from 'lucide-react';
import { api } from '../../api/client';
import { getStaffRole } from '../../constants/staffRoles';
import StaffAuthShell from '../../components/auth/StaffAuthShell';
import { AuthField, PasswordField } from '../../components/auth/AuthField';
import CodeInput from '../../components/auth/CodeInput';
import FormAlert from '../../components/auth/FormAlert';
import SubmitButton from '../../components/auth/SubmitButton';
import PasswordRequirements from '../../components/PasswordRequirements';
import { isPasswordValid } from '../../utils/password';

const CODE_LENGTH = 8;
const STAGES = ['request', 'sent', 'reset', 'done'];

// Staff-portal password reset. Employees can't reset by email: asking for a reset puts a
// request on the admin's Approvals page, and approving it gives the admin a one-time code to
// hand over, which the employee enters here with their new password. Admin accounts use the
// same page but get their code by email. The backend picks which path and answers the same
// way either way, so this page can't reveal whether (or what kind of) account an email has.
// `?role=` (from the sign-in page) keeps that role's room lit and leads back to its sign-in.
export default function StaffForgotPassword() {
  const [searchParams] = useSearchParams();
  const role = getStaffRole(searchParams.get('role'));
  const signInPath = role ? `/admin/login?role=${role.key}` : '/admin/login';

  const [stage, setStage] = useState('request'); // 'request' | 'sent' | 'reset' | 'done'
  const [dir, setDir] = useState(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [loading, setLoading] = useState(false);

  const goTo = (next) => {
    setError('');
    setDir(STAGES.indexOf(next) > STAGES.indexOf(stage) ? 'forward' : 'back');
    setStage(next);
  };

  const fail = (message) => {
    setError(message);
    setErrorKey(k => k + 1);
  };

  const requestReset = async (e) => {
    e.preventDefault();
    if (!email.trim()) { fail('Enter your staff email.'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      goTo('sent');
    } catch (err) {
      fail(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (!email.trim()) { fail('Enter your staff email.'); return; }
    if (code.trim().length !== CODE_LENGTH) { fail(`Enter all ${CODE_LENGTH} characters of your reset code.`); return; }
    if (!isPasswordValid(password)) { fail('Your new password needs to meet every requirement below.'); return; }
    if (password !== confirmPassword) { fail("Passwords don't match."); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { email: email.trim(), code: code.trim(), password });
      goTo('done');
    } catch (err) {
      fail(err.message);
    } finally {
      setLoading(false);
    }
  };

  const emailField = (autoFocus) => (
    <AuthField
      id="staff-reset-email"
      label="Staff email"
      type="email"
      autoComplete="email"
      inputMode="email"
      autoFocus={autoFocus}
      value={email}
      onChange={e => setEmail(e.target.value)}
    />
  );

  const backToSignIn = (
    <Link to={signInPath} className="text-gray-500 hover:text-brand-navy">Back to sign in</Link>
  );

  const shell = {
    step: stage,
    stepDir: dir,
    status: stage === 'done' ? 'Password changed' : 'Password reset',
    plan: { activeKey: role?.key, success: stage === 'done', flickerKey: errorKey },
  };

  if (stage === 'sent') {
    return (
      <StaffAuthShell {...shell} title="Request sent" subtitle="An administrator needs to approve it before you can choose a new password.">
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3.5">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700 space-y-1.5 min-w-0">
              <p className="font-semibold text-gray-900">Waiting for admin approval</p>
              <p>If <span className="font-medium break-all">{email.trim()}</span> is a staff account, an administrator has been notified. Once they approve it, they'll give you an {CODE_LENGTH}-character reset code.</p>
              <p className="text-xs text-gray-500">Administrator accounts get their reset code by email instead.</p>
            </div>
          </div>
          <button type="button" onClick={() => goTo('reset')} className="btn-primary group w-full flex items-center justify-center gap-2 py-3">
            Enter my reset code <KeyRound className="w-4 h-4" />
          </button>
          <p className="text-center text-sm">{backToSignIn}</p>
        </div>
      </StaffAuthShell>
    );
  }

  if (stage === 'reset') {
    const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
    return (
      <StaffAuthShell {...shell} title="Choose a new password" subtitle="Enter the reset code your administrator gave you, then pick a new password.">
        <form onSubmit={resetPassword} noValidate className="space-y-5">
          {emailField(!email)}
          <div>
            <p id="staff-reset-code-label" className="text-sm font-medium text-brand-ink mb-2">Reset code</p>
            <CodeInput
              id="staff-reset-code"
              labelledBy="staff-reset-code-label"
              value={code}
              onChange={(next) => { setCode(next); if (error) setError(''); }}
              autoFocus={!!email}
            />
          </div>
          <div>
            <PasswordField
              id="staff-reset-password"
              label="New password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <PasswordRequirements password={password} />
          </div>
          <PasswordField
            id="staff-reset-confirm"
            label="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
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
          <div className="flex items-center justify-between gap-3 text-sm">
            {backToSignIn}
            <button type="button" onClick={() => goTo('request')} className="text-brand-orange font-semibold hover:underline">Need a code?</button>
          </div>
        </form>
      </StaffAuthShell>
    );
  }

  if (stage === 'done') {
    return (
      <StaffAuthShell {...shell} title="Password changed">
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl bg-brand-teal/10 px-4 py-3.5">
            <CheckCircle2 className="auth-pop w-5 h-5 mt-0.5 shrink-0 text-teal-700" />
            <p className="text-sm text-brand-navy">Your password for <span className="font-semibold break-all">{email.trim()}</span> has been changed. Sign in with your new password.</p>
          </div>
          <Link to={signInPath} className="btn-primary group w-full flex items-center justify-center gap-2 py-3">
            Back to sign in <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </StaffAuthShell>
    );
  }

  return (
    <StaffAuthShell {...shell} title="Reset your password" subtitle="Enter your staff email. An administrator has to approve the reset before you can choose a new password.">
      <form onSubmit={requestReset} noValidate className="space-y-5">
        {emailField(true)}
        <FormAlert key={errorKey}>{error}</FormAlert>
        <SubmitButton loading={loading} icon={Send} loadingLabel="Sending request…">
          Request reset
        </SubmitButton>
        <div className="flex items-center justify-between gap-3 text-sm">
          {backToSignIn}
          <button type="button" onClick={() => goTo('reset')} className="text-brand-orange font-semibold hover:underline">I have a reset code</button>
        </div>
      </form>
    </StaffAuthShell>
  );
}
