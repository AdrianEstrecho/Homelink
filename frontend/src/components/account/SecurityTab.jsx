import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CheckCircle2, KeyRound, Loader2, Lock, ShieldCheck, ShieldOff } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { isPasswordValid } from '../../utils/password';
import { PasswordField } from '../auth/AuthField';
import CodeInput from '../auth/CodeInput';
import FormAlert from '../auth/FormAlert';
import ResendCode from '../auth/ResendCode';
import ConfirmDialog from '../ConfirmDialog';
import PasswordRequirements from '../PasswordRequirements';
import Switch from '../Switch';

const CODE_LENGTH = 8;
const PANEL = 'rounded-2xl border border-gray-100 bg-gray-50/70 p-5 sm:p-6';
const emptyForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function SecurityTab() {
  return (
    <div>
      <h2 className="font-display font-bold text-lg text-brand-ink mb-1">Security</h2>
      <p className="text-sm text-gray-500 mb-6">Manage your password and how you sign in to HomeLink.</p>

      <div className="grid xl:grid-cols-2 gap-6 items-start">
        <PasswordSection />
        <div className="space-y-6">
          <TwoFactorSection />
          <div className="flex items-start gap-3 rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
            <Lock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <p>Your password is never stored in plain text — HomeLink only keeps a one-way hash of it.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description, aside }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-gray-100 shadow-sm">
        <Icon className="w-[18px] h-[18px] text-brand-navy" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-display font-bold text-brand-ink">{title}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      {aside}
    </div>
  );
}

function PasswordSection() {
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordsMatch = form.confirmPassword.length > 0 && form.newPassword === form.confirmPassword;

  const update = (key) => (e) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
    setFieldErrors(fe => ({ ...fe, [key]: undefined }));
    setSuccess(false);
  };

  // Same rules the backend enforces (validatePasswordStrength), checked here first so a weak
  // password is caught while typing instead of after a round trip.
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.currentPassword) errs.currentPassword = 'Enter your current password.';
    if (!isPasswordValid(form.newPassword)) errs.newPassword = 'Your new password needs to meet every requirement below.';
    else if (form.newPassword === form.currentPassword) errs.newPassword = 'Choose a password different from your current one.';
    if (!form.confirmPassword) errs.confirmPassword = 'Re-enter your new password.';
    else if (!passwordsMatch) errs.confirmPassword = "Passwords don't match.";
    setFieldErrors(errs);
    setError('');
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await api.put('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm(emptyForm);
      setSuccess(true);
    } catch (err) {
      // A wrong current password belongs to that field, not to a generic alert under the form.
      if (/current password is incorrect/i.test(err.message)) {
        setFieldErrors({ currentPassword: "That's not your current password." });
      } else {
        setError(err.message);
        setErrorKey(k => k + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={PANEL}>
      <SectionHeader icon={KeyRound} title="Change password" description="Pick a strong password you don't use for any other site." />

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5 max-w-lg">
        <PasswordField
          id="security-current-password"
          label="Current password"
          labelAside={<Link to="/forgot-password" className="text-xs font-semibold text-brand-orange hover:underline">Forgot it?</Link>}
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={update('currentPassword')}
          error={fieldErrors.currentPassword}
        />
        <div>
          <PasswordField
            id="security-new-password"
            label="New password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={update('newPassword')}
            error={fieldErrors.newPassword}
          />
          <PasswordRequirements password={form.newPassword} />
        </div>
        <PasswordField
          id="security-confirm-password"
          label="Confirm new password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={update('confirmPassword')}
          error={fieldErrors.confirmPassword}
          hint={passwordsMatch ? (
            <span className="inline-flex items-center gap-1 font-medium text-teal-700">
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Passwords match
            </span>
          ) : undefined}
        />

        <FormAlert key={errorKey}>{error}</FormAlert>
        {success && (
          <div role="status" className="flex items-start gap-2.5 rounded-xl bg-brand-teal/10 px-3.5 py-3 text-sm text-brand-navy">
            <CheckCircle2 className="auth-pop w-4 h-4 mt-0.5 shrink-0 text-teal-700" />
            <p>Password updated. Use your new password the next time you sign in.</p>
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </section>
  );
}

function TwoFactorSection() {
  const { user, setTwoFactorEnabled, sendTwoFactorSetupCode } = useAuth();
  const enabled = !!user?.twoFactorEnabled;
  const [stage, setStage] = useState('idle'); // 'idle' | 'code'
  const [code, setCode] = useState('');
  const [codeSentAt, setCodeSentAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  const fail = (err) => { setError(err.message); setErrorKey(k => k + 1); };

  const sendCode = async () => {
    await sendTwoFactorSetupCode();
    setCodeSentAt(Date.now());
    setCode('');
  };

  // Turning it on needs the emailed code first, so the switch only starts that flow. Turning it
  // off needs no code (nothing for a stolen one to bypass) — just a confirmation, so a stray
  // click can't quietly drop the protection.
  const handleToggle = async () => {
    setError('');
    setJustEnabled(false);
    if (enabled) { setConfirmingOff(true); return; }
    setBusy(true);
    try {
      await sendCode();
      setStage('code');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  // ResendCode wants a rejection on failure; the alert below shows the message.
  const handleResend = async () => {
    setError('');
    try {
      await sendCode();
    } catch (err) {
      fail(err);
      throw err;
    }
  };

  const verify = async (value = code) => {
    if (busy) return;
    if (value.length !== CODE_LENGTH) {
      fail(new Error(`Enter all ${CODE_LENGTH} characters of the code.`));
      return;
    }
    setError('');
    setBusy(true);
    try {
      await setTwoFactorEnabled(true, value);
      setStage('idle');
      setCode('');
      setJustEnabled(true);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setConfirmingOff(false);
    setBusy(true);
    try {
      await setTwoFactorEnabled(false);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const cancelSetup = () => { setStage('idle'); setCode(''); setError(''); };

  return (
    <section className={PANEL}>
      <SectionHeader
        icon={ShieldCheck}
        title="Two-factor authentication"
        description="Adds a one-time email code to every sign-in, so a leaked password alone can't get anyone in."
        aside={
          <div className="pt-2">
            <Switch checked={enabled} onChange={handleToggle} disabled={busy || stage === 'code'} label="Two-factor authentication" />
          </div>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-gray-500">
        {enabled ? (
          <span className="badge gap-1 bg-brand-teal/15 text-teal-700"><ShieldCheck className="w-3 h-3" /> On</span>
        ) : (
          <span className="badge bg-gray-200/70 text-gray-600">Off</span>
        )}
        <span>
          {enabled ? <>Codes go to <span className="font-medium text-gray-700">{user?.email}</span></> : 'Recommended for every account'}
        </span>
      </div>

      {stage === 'code' && (
        <form onSubmit={(e) => { e.preventDefault(); verify(); }} noValidate className="mt-5 pt-5 border-t border-gray-200/70 space-y-4">
          <div>
            <p id="security-2fa-code-label" className="text-sm font-medium text-brand-ink">Enter the code we just emailed you</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Sent to <span className="font-medium text-gray-700">{user?.email}</span> · expires in 10 minutes
            </p>
          </div>
          <CodeInput
            id="security-2fa-code"
            labelledBy="security-2fa-code-label"
            value={code}
            onChange={(next) => { setCode(next); if (error) setError(''); }}
            onComplete={verify}
            invalid={Boolean(error)}
            disabled={busy}
            autoFocus
          />
          <ResendCode sentAt={codeSentAt} onResend={handleResend} />
          <FormAlert key={errorKey}>{error}</FormAlert>
          <div className="flex items-center gap-4">
            <button type="submit" disabled={busy} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {busy ? 'Verifying…' : 'Verify & turn on'}
            </button>
            <button type="button" onClick={cancelSetup} className="text-sm font-medium text-gray-500 hover:text-brand-navy">Cancel</button>
          </div>
        </form>
      )}

      {stage === 'idle' && error && (
        <div className="mt-4"><FormAlert key={errorKey}>{error}</FormAlert></div>
      )}
      {stage === 'idle' && justEnabled && enabled && (
        <div role="status" className="mt-4 flex items-start gap-2.5 rounded-xl bg-brand-teal/10 px-3.5 py-3 text-sm text-brand-navy">
          <CheckCircle2 className="auth-pop w-4 h-4 mt-0.5 shrink-0 text-teal-700" />
          <p>Two-factor authentication is on. You'll be asked for a code the next time you sign in.</p>
        </div>
      )}

      <ConfirmDialog
        open={confirmingOff}
        icon={ShieldOff}
        tone="update"
        title="Turn off two-factor authentication?"
        message="You'll sign in with just your password. You can turn it back on at any time."
        confirmLabel="Turn off"
        onConfirm={turnOff}
        onCancel={() => setConfirmingOff(false)}
      />
    </section>
  );
}
