import { useState } from 'react';
import { User, Mail, Phone, MapPin, Pencil, X, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ProfileTab() {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '', phone: user?.phone || '', address: user?.address || '' });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await updateProfile(form);
    setSaving(false);
    setEditing(false);
  };

  const cancelEdit = () => {
    setForm({ firstName: user?.firstName || '', lastName: user?.lastName || '', phone: user?.phone || '', address: user?.address || '' });
    setEditing(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-bold text-lg text-brand-ink">Profile Details</h2>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy hover:text-brand-orange transition">
            <Pencil className="w-4 h-4" /> Edit Profile
          </button>
        ) : (
          <button onClick={cancelEdit} className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition">
            <X className="w-4 h-4" /> Cancel
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First Name">
              <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="input-field" required />
            </Field>
            <Field label="Last Name">
              <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="input-field" required />
            </Field>
          </div>
          <Field label="Phone Number">
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="09XXXXXXXXX" />
          </Field>
          <Field label="Address">
            <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} className="input-field" />
          </Field>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoTile icon={User} label="Full Name" value={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Not set'} />
          <InfoTile icon={Mail} label="Email Address" value={user?.email} />
          <InfoTile icon={Phone} label="Phone Number" value={user?.phone || 'Not set'} />
          <InfoTile icon={MapPin} label="Address" value={user?.address || 'Not set'} />
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
      <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 border border-gray-100">
        <Icon className="w-4 h-4 text-brand-navy" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
      </div>
    </div>
  );
}
