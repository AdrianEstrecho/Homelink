import { useState } from 'react';
import { Lock, KeyRound, CheckCircle2, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const emptyForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function SecurityTab() {
  const { user, setTwoFactorEnabled, sendTwoFactorSetupCode } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [twoFactorSaving, setTwoFactorSaving] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState('');
  const [setupStage, setSetupStage] = useState('idle'); // 'idle' | 'code'
  const [setupCode, setSetupCode] = useState('');
  const [setupResent, setSetupResent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    setSaving(true);
    try {
      await api.put('/auth/change-password', form);
      setForm(emptyForm);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTwoFactor = async () => {
    setTwoFactorError('');
    // Turning it off is immediate — nothing here for a stolen code to bypass. Turning it
    // on needs the emailed code first, so the toggle just starts that flow.
    if (user.twoFactorEnabled) {
      setTwoFactorSaving(true);
      try {
        await setTwoFactorEnabled(false);
      } catch (err) {
        setTwoFactorError(err.message);
      } finally {
        setTwoFactorSaving(false);
      }
      return;
    }
    setTwoFactorSaving(true);
    try {
      await sendTwoFactorSetupCode();
      setSetupStage('code');
    } catch (err) {
      setTwoFactorError(err.message);
    } finally {
      setTwoFactorSaving(false);
    }
  };

  const handleVerifyAndEnable = async (e) => {
    e.preventDefault();
    setTwoFactorError('');
    setTwoFactorSaving(true);
    try {
      await setTwoFactorEnabled(true, setupCode);
      setSetupStage('idle');
      setSetupCode('');
      setSetupResent(false);
    } catch (err) {
      setTwoFactorError(err.message);
    } finally {
      setTwoFactorSaving(false);
    }
  };

  const handleResendSetupCode = async () => {
    setTwoFactorError('');
    setSetupResent(false);
    try {
      await sendTwoFactorSetupCode();
      setSetupResent(true);
    } catch (err) {
      setTwoFactorError(err.message);
    }
  };

  const handleCancelSetup = () => {
    setSetupStage('idle');
    setSetupCode('');
    setSetupResent(false);
    setTwoFactorError('');
  };

  return (
    <div>
      <h2 className="font-display font-bold text-lg text-brand-ink mb-1">Security</h2>
      <p className="text-sm text-gray-500 mb-6">Update your password to keep your account secure.</p>

      <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-700">Current Password</label>
          <input type="password" value={form.currentPassword} onChange={e => { setForm({ ...form, currentPassword: e.target.value }); setSuccess(false); }} className="input-field" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-700">New Password</label>
          <input type="password" value={form.newPassword} onChange={e => { setForm({ ...form, newPassword: e.target.value }); setSuccess(false); }} className="input-field" required minLength={6} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-700">Confirm New Password</label>
          <input type="password" value={form.confirmPassword} onChange={e => { setForm({ ...form, confirmPassword: e.target.value }); setSuccess(false); }} className="input-field" required minLength={6} />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && <p className="flex items-center gap-1.5 text-brand-teal text-sm font-medium"><CheckCircle2 className="w-4 h-4" /> Password updated successfully.</p>}
        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-60">
          <KeyRound className="w-4 h-4" /> {saving ? 'Updating...' : 'Update Password'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-100 max-w-sm">
        <h3 className="font-display font-bold text-brand-ink flex items-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-brand-teal" /> Two-Factor Authentication
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          When enabled, we'll email you a one-time code to enter each time you sign in.
        </p>

        {setupStage === 'code' ? (
          <form onSubmit={handleVerifyAndEnable} className="space-y-3">
            <p className="text-sm text-gray-600">Enter the verification code we emailed you to turn on two-factor authentication.</p>
            <input
              required
              autoFocus
              value={setupCode}
              onChange={e => setSetupCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="input-field tracking-widest font-mono uppercase"
              placeholder="XXXXXXXX"
            />
            <p className="text-xs text-gray-500">
              Didn't receive a code?{' '}
              <button type="button" onClick={handleResendSetupCode} className="text-brand-orange font-semibold hover:underline">Resend</button>
              {setupResent && <span className="text-green-600 ml-1">Sent!</span>}
            </p>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={twoFactorSaving} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                <ShieldCheck className="w-4 h-4" /> {twoFactorSaving ? 'Verifying...' : 'Enable'}
              </button>
              <button type="button" onClick={handleCancelSetup} className="text-sm text-gray-500 hover:text-brand-navy">Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={handleToggleTwoFactor}
              disabled={twoFactorSaving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${user?.twoFactorEnabled ? 'bg-brand-teal' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user?.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="ml-3 text-sm text-gray-700 align-middle">{user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}</span>
          </>
        )}
        {twoFactorError && <p className="text-red-600 text-sm mt-2">{twoFactorError}</p>}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 flex items-start gap-3 text-sm text-gray-500 max-w-sm">
        <Lock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
        <p>Your password is never stored in plain text — HomeLink only keeps a one-way hash of it.</p>
      </div>
    </div>
  );
}
