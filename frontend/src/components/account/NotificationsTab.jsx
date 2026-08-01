import { useState } from 'react';
import { Package, Calendar, Megaphone, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';

export default function NotificationsTab() {
  const { user, refreshUser } = useAuth();
  const [prefs, setPrefs] = useState({
    notifyOrders: user?.notifyOrders ?? true,
    notifyBookings: user?.notifyBookings ?? true,
    notifyPromotions: user?.notifyPromotions ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (key) => setPrefs(p => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    setSaving(true);
    await api.put('/auth/notifications', prefs);
    await refreshUser();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const OPTIONS = [
    { key: 'notifyOrders', icon: Package, title: 'Order updates', desc: 'Confirmation, shipping, and delivery status for your orders.' },
    { key: 'notifyBookings', icon: Calendar, title: 'Booking reminders', desc: 'Confirmations and reminders for your service appointments.' },
    { key: 'notifyPromotions', icon: Megaphone, title: 'Promotions & offers', desc: 'Seasonal discounts, vouchers, and new product announcements.' },
  ];

  return (
    <div>
      <h2 className="font-display font-semibold text-lg text-brand-navy mb-1">Notification Preferences</h2>
      <p className="text-sm text-gray-500 mb-6">Choose what HomeLink emails you about.</p>

      <div className="space-y-3">
        {OPTIONS.map(o => (
          <div key={o.key} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 border border-gray-100">
              <o.icon className="w-4 h-4 text-brand-navy" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800">{o.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{o.desc}</p>
            </div>
            <Switch checked={prefs[o.key]} onChange={() => toggle(o.key)} />
          </div>
        ))}
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 mt-6 disabled:opacity-60">
        {saved ? <Check className="w-4 h-4" /> : null} {saving ? 'Saving...' : saved ? 'Saved' : 'Save Preferences'}
      </button>
    </div>
  );
}

function Switch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-brand-orange' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}
