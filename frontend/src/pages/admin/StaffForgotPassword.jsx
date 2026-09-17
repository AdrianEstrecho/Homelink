import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, KeyRound, CheckCircle2, Clock, LogIn } from 'lucide-react';
import { api } from '../../api/client';
import StaffAuthShell from '../../components/auth/StaffAuthShell';
import PasswordRequirements from '../../components/PasswordRequirements';
import { isPasswordValid } from '../../utils/password';

const CODE_LENGTH = 8;

// Staff-portal password reset. Employees can't reset by email: asking for a reset puts a
// request on the admin's Approvals page, and approving it gives the admin a one-time code to
// hand over, which the employee enters here with their new password. Admin accounts use the
// same page but get their code by email. The backend picks which path and answers the same
// way either way, so this page can't reveal whether (or what kind of) account an email has.
export default function StaffForgotPassword() {
  const [stage, setStage] = useState('request'); // 'request' | 'sent' | 'reset' | 'done'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const goTo = (next) => { setError(''); setStage(next); };

  const requestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      goTo('sent');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (code.trim().length !== CODE_LENGTH) { setError(`Enter all ${CODE_LENGTH} characters of your reset code.`); return; }
    if (!isPasswordValid(password)) { setError('Your new password needs to meet every requirement below.'); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { email: email.trim(), code: code.trim(), password });
      goTo('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const emailField = (autoFocus) => (
    <div>
      <label htmlFor="staff-reset-email" className="block text-sm font-medium mb-1.5">Email</label>
      <input
        id="staff-reset-email"
        type="email"
        required
        autoFocus={autoFocus}
        autoComplete="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="input-field"
        placeholder="you@homelink.com"
      />
    </div>
  );

  return (
    <StaffAuthShell>
      {stage === 'request' && (
        <form onSubmit={requestReset} className="p-8 space-y-5">
          <div>
            <h2 className="font-semibold text-gray-900">Forgot your password?</h2>
            <p className="text-sm text-gray-500 mt-1">Enter your staff email. An administrator has to approve the reset before you can choose a new password.</p>
          </div>
          {emailField(true)}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-secondary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50">
            <Send className="w-4 h-4" /> {loading ? 'Sending request...' : 'Request Password Reset'}
          </button>
          <div className="flex items-center justify-between gap-3 text-sm">
            <Link to="/admin/login" className="text-gray-500 hover:text-brand-navy">Back to login</Link>
            <button type="button" onClick={() => goTo('reset')} className="text-brand-orange font-semibold hover:underline">I have a reset code</button>
          </div>
        </form>
      )}

      {stage === 'sent' && (
        <div className="p-8 space-y-5">
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3.5">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700 space-y-1.5 min-w-0">
              <p className="font-semibold text-gray-900">Waiting for admin approval</p>
              <p>If <span className="font-medium break-all">{email.trim()}</span> is a staff account, an administrator has been notified. Once they approve it, they'll give you an {CODE_LENGTH}-character reset code.</p>
              <p className="text-xs text-gray-500">Administrator accounts get their reset code by email instead.</p>
            </div>
          </div>
          <button type="button" onClick={() => goTo('reset')} className="btn-secondary w-full flex items-center justify-center gap-2 py-3">
            <KeyRound className="w-4 h-4" /> I Have My Reset Code
          </button>
          <Link to="/admin/login" className="block text-center text-sm text-gray-500 hover:text-brand-navy">Back to login</Link>
        </div>
      )}

      {stage === 'reset' && (
        <form onSubmit={resetPassword} noValidate className="p-8 space-y-5">
          <div>
            <h2 className="font-semibold text-gray-900">Choose a new password</h2>
            <p className="text-sm text-gray-500 mt-1">Enter the reset code your administrator gave you.</p>
          </div>
          {emailField(!email)}
          <div>
            <label htmlFor="staff-reset-code" className="block text-sm font-medium mb-1.5">Reset Code</label>
            <input
              id="staff-reset-code"
              required
              autoFocus={!!email}
              autoComplete="one-time-code"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              maxLength={CODE_LENGTH}
              className="input-field tracking-widest font-mono uppercase"
              placeholder="XXXXXXXX"
            />
          </div>
          <div>
            <label htmlFor="staff-reset-password" className="block text-sm font-medium mb-1.5">New Password</label>
            <input
              id="staff-reset-password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-field"
            />
            <PasswordRequirements password={password} />
          </div>
          <div>
            <label htmlFor="staff-reset-confirm" className="block text-sm font-medium mb-1.5">Confirm New Password</label>
            <input
              id="staff-reset-confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="input-field"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-secondary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50">
            <KeyRound className="w-4 h-4" /> {loading ? 'Saving...' : 'Change Password'}
          </button>
          <div className="flex items-center justify-between gap-3 text-sm">
            <Link to="/admin/login" className="text-gray-500 hover:text-brand-navy">Back to login</Link>
            <button type="button" onClick={() => goTo('request')} className="text-brand-orange font-semibold hover:underline">Need a code?</button>
          </div>
        </form>
      )}

      {stage === 'done' && (
        <div className="p-8 space-y-5">
          <div className="flex items-start gap-3 rounded-xl bg-brand-teal/10 px-4 py-3.5">
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-teal-700" />
            <p className="text-sm text-brand-navy">Your password for <span className="font-semibold break-all">{email.trim()}</span> has been changed. Sign in with your new password.</p>
          </div>
          <Link to="/admin/login" className="btn-secondary w-full flex items-center justify-center gap-2 py-3">
            <LogIn className="w-4 h-4" /> Back to Sign In
          </Link>
        </div>
      )}
    </StaffAuthShell>
  );
}
