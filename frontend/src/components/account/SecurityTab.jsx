import { useState } from 'react';
import { Lock, KeyRound, CheckCircle2 } from 'lucide-react';
import { api } from '../../api/client';

const emptyForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function SecurityTab() {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

  return (
    <div>
      <h2 className="font-display font-semibold text-lg text-brand-navy mb-1">Security</h2>
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
        {success && <p className="flex items-center gap-1.5 text-[#00806f] text-sm font-medium"><CheckCircle2 className="w-4 h-4" /> Password updated successfully.</p>}
        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-60">
          <KeyRound className="w-4 h-4" /> {saving ? 'Updating...' : 'Update Password'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-100 flex items-start gap-3 text-sm text-gray-500 max-w-sm">
        <Lock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
        <p>Your password is never stored in plain text — HomeLink only keeps a one-way hash of it.</p>
      </div>
    </div>
  );
}
