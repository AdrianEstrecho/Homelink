import { useEffect, useState } from 'react';
import { Mail, Phone, MapPin, CalendarDays } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import ProfileTab from './ProfileTab';
import SecurityTab from './SecurityTab';

const AVATAR_COLORS = ['bg-brand-navy', 'bg-brand-blue', 'bg-[#00806f]', 'bg-[#c8461a]'];
const ROLE_LABEL = { employee: 'Employee', admin: 'Administrator' };
const POSITION_LABELS = {
  inventory_clerk: 'Inventory Clerk',
  booking_coordinator: 'Booking Coordinator',
  installer: 'Installer / Technician',
  accounting: 'Accounting',
  hr: 'Human Resources',
  general_staff: 'General Staff',
};

const TABS = [
  { key: 'profile', label: 'Profile Details', Component: ProfileTab },
  { key: 'security', label: 'Security', Component: SecurityTab },
];

function avatarColor(seed) {
  const sum = [...(seed || 'H')].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function initials(first, last) {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || 'H';
}

export default function StaffProfileCard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('profile');
  const [jobStats, setJobStats] = useState(null);

  useEffect(() => {
    if (user?.role === 'employee') {
      api.get('/employee/dashboard').then(d => setJobStats(d.stats)).catch(() => {});
    }
  }, [user?.role]);

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  const ActiveTab = TABS.find(t => t.key === tab)?.Component || ProfileTab;

  return (
    <div>
      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className={`w-20 h-20 rounded-2xl ${avatarColor(user?.id)} flex items-center justify-center text-2xl font-display font-bold text-white shrink-0`}>
            {initials(user?.firstName, user?.lastName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-xl font-bold text-gray-800">{user?.firstName} {user?.lastName}</h2>
              <span className="badge bg-brand-navy/10 text-brand-navy">{ROLE_LABEL[user?.role] || user?.role}</span>
              {user?.position && <span className="badge bg-teal-50 text-[#00806f]">{POSITION_LABELS[user.position] || user.position}</span>}
            </div>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 pt-5 border-t border-gray-100 text-sm text-gray-500">
          <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {user?.email}</span>
          <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {user?.phone || 'Not set'}</span>
          <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {user?.address || 'Not set'}</span>
          <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Joined {memberSince}</span>
        </div>
      </div>

      {jobStats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Assigned Jobs" value={jobStats.total} />
          <StatCard label="Pending" value={jobStats.pending} />
          <StatCard label="Completed" value={jobStats.completed} />
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card p-6">
        <ActiveTab />
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card p-4 text-center">
      <p className="font-display text-2xl font-bold text-brand-navy">{value ?? '—'}</p>
      <p className="text-xs text-gray-400 uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}
