import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Package, Calendar, LogOut, ShieldCheck, ArrowLeft, ArrowRight,
  MapPinned, CreditCard, Bell, Lock, Star, LayoutDashboard, LifeBuoy,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import Reveal from '../components/Reveal';
import ConfirmDialog from '../components/ConfirmDialog';
import ProfileTab from '../components/account/ProfileTab';
import AddressesTab from '../components/account/AddressesTab';
import PaymentTab from '../components/account/PaymentTab';
import NotificationsTab from '../components/account/NotificationsTab';
import SecurityTab from '../components/account/SecurityTab';
import ReviewsTab from '../components/account/ReviewsTab';
import SupportTab from '../components/account/SupportTab';

const AVATAR_COLORS = ['bg-brand-navy', 'bg-brand-blue', 'bg-[#00806f]', 'bg-[#c8461a]'];
const ROLE_LABEL = { customer: 'Customer', employee: 'Employee', admin: 'Administrator' };

const TABS = [
  { key: 'profile', label: 'Profile Details', icon: User, Component: ProfileTab },
  { key: 'address', label: 'Address', icon: MapPinned, Component: AddressesTab },
  { key: 'payment', label: 'Payment', icon: CreditCard, Component: PaymentTab },
  { key: 'notifications', label: 'Notifications', icon: Bell, Component: NotificationsTab },
  { key: 'security', label: 'Security', icon: Lock, Component: SecurityTab },
  { key: 'reviews', label: 'Reviews', icon: Star, Component: ReviewsTab },
  { key: 'support', label: 'Support', icon: LifeBuoy, Component: SupportTab },
];

function avatarColor(seed) {
  const sum = [...(seed || 'H')].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function initials(first, last) {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || 'H';
}

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile');
  const [counts, setCounts] = useState({ orders: null, bookings: null });
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    api.get('/orders/my').then(d => setCounts(c => ({ ...c, orders: d.length }))).catch(() => setCounts(c => ({ ...c, orders: 0 })));
    api.get('/bookings/my').then(d => setCounts(c => ({ ...c, bookings: d.length }))).catch(() => setCounts(c => ({ ...c, bookings: 0 })));
  }, []);

  const handleLogout = () => { logout(); navigate('/'); };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  const ActiveTab = TABS.find(t => t.key === tab)?.Component || ProfileTab;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-brand-navy transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Banner */}
      <Reveal className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy via-brand-blue to-brand-navy text-white p-6 sm:p-8 mb-6">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="float-blob absolute -top-10 -left-10 w-56 h-56 bg-brand-orange rounded-full blur-3xl" />
          <div className="float-blob-delayed absolute -bottom-16 -right-10 w-64 h-64 bg-brand-teal rounded-full blur-3xl" />
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className={`w-20 h-20 rounded-2xl ${avatarColor(user?.id || user?.email)} flex items-center justify-center text-2xl font-display font-bold ring-4 ring-white/15 shrink-0`}>
            {initials(user?.firstName, user?.lastName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl font-bold truncate">{user?.firstName} {user?.lastName}</h1>
              <span className="badge bg-white/15 text-white flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> {ROLE_LABEL[user?.role] || 'Customer'}
              </span>
            </div>
            <p className="text-gray-300 text-sm truncate">{user?.email}</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <StatPill label="Orders" value={counts.orders} />
            <StatPill label="Bookings" value={counts.bookings} />
            <StatPill label="Member Since" value={memberSince} />
          </div>
        </div>
      </Reveal>

      {/* Portal access — admins and employees only */}
      {(user?.role === 'admin' || user?.role === 'employee') && (
        <Reveal delay={40} className="mb-6">
          <Link
            to={user.role === 'admin' ? '/admin' : '/employee'}
            className="card flex items-center justify-between gap-4 p-5 hover:shadow-md hover:-translate-y-0.5 group"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-brand-navy/10 flex items-center justify-center shrink-0 group-hover:bg-brand-orange/10 transition-colors">
                <LayoutDashboard className="w-5 h-5 text-brand-navy group-hover:text-brand-orange transition-colors" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-800">{user.role === 'admin' ? 'Admin Portal' : 'Employee Portal'}</p>
                <p className="text-sm text-gray-500 truncate">
                  {user.role === 'admin' ? 'Manage products, services, orders, bookings, and users.' : 'View and manage your assigned service jobs.'}
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-brand-orange group-hover:translate-x-1 transition shrink-0" />
          </Link>
        </Reveal>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar */}
        <Reveal as="nav" delay={80} className="card p-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible h-fit">
          {(user?.role === 'admin' || user?.role === 'employee') && (
            <Link
              to={user.role === 'admin' ? '/admin' : '/employee'}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition whitespace-nowrap text-brand-orange font-semibold hover:bg-orange-50 md:mb-1 md:pb-3 md:border-b md:border-gray-100"
            >
              <LayoutDashboard className="w-4 h-4" /> {user.role === 'admin' ? 'Admin Portal' : 'Employee Portal'}
            </Link>
          )}
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition whitespace-nowrap text-left ${tab === t.key ? 'bg-brand-navy/10 text-brand-navy font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
          <Link to="/orders" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-700 text-sm transition whitespace-nowrap">
            <Package className="w-4 h-4 text-brand-orange" /> My Orders
          </Link>
          <Link to="/bookings" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-700 text-sm transition whitespace-nowrap">
            <Calendar className="w-4 h-4 text-[#00806f]" /> My Bookings
          </Link>
          <button onClick={() => setConfirmLogout(true)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-red-50 text-red-600 text-sm transition whitespace-nowrap md:mt-2 md:border-t md:pt-3">
            <LogOut className="w-4 h-4" /> Log Out
          </button>
        </Reveal>

        <ConfirmDialog
          open={confirmLogout}
          icon={LogOut}
          title="Log out of HomeLink?"
          message="You'll need to sign in again to access your account, orders, and bookings."
          confirmLabel="Log Out"
          onConfirm={handleLogout}
          onCancel={() => setConfirmLogout(false)}
        />

        {/* Active tab content */}
        <Reveal delay={140} className="card p-6">
          <ActiveTab />
        </Reveal>
      </div>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="text-center px-3 py-1.5 rounded-xl bg-white/10 min-w-[76px]">
      <p className="font-display font-bold text-lg leading-tight">{value === null ? '—' : value}</p>
      <p className="text-[10.5px] uppercase tracking-wide text-gray-300">{label}</p>
    </div>
  );
}
