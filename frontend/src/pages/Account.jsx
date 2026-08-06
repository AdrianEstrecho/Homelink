import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Package, Calendar, LogOut, ShieldCheck, ArrowLeft, ArrowRight,
  MapPinned, CreditCard, Bell, Lock, Star, LayoutDashboard, LifeBuoy, Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import Reveal from '../components/Reveal';
import CountUp from '../components/CountUp';
import ConfirmDialog from '../components/ConfirmDialog';
import PageTransitionOverlay from '../components/PageTransitionOverlay';
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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile');
  const [counts, setCounts] = useState({ orders: null, bookings: null });
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    api.get('/orders/my').then(d => setCounts(c => ({ ...c, orders: d.length }))).catch(() => setCounts(c => ({ ...c, orders: 0 })));
    api.get('/bookings/my').then(d => setCounts(c => ({ ...c, bookings: d.length }))).catch(() => setCounts(c => ({ ...c, bookings: 0 })));
  }, []);

  const handleLogout = () => {
    setConfirmLogout(false);
    setLoggingOut(true);
    setTimeout(() => { logout(); window.location.href = '/'; }, 600);
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  const ActiveTab = TABS.find(t => t.key === tab)?.Component || ProfileTab;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-brand-navy transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <Reveal className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy via-brand-blue to-brand-navy text-white p-6 sm:p-8 pb-14 sm:pb-16 shadow-lg shadow-brand-navy/10">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="float-blob absolute -top-10 -left-10 w-56 h-56 bg-brand-orange rounded-full blur-3xl" />
          <div className="float-blob-delayed absolute -bottom-16 -right-10 w-64 h-64 bg-brand-teal rounded-full blur-3xl" />
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div className={`relative w-20 h-20 rounded-full ${avatarColor(user?.id || user?.email)} flex items-center justify-center text-2xl font-display font-bold ring-4 ring-white/20 shadow-xl shrink-0`}>
            {initials(user?.firstName, user?.lastName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50 mb-1.5">{greeting()}</p>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight truncate">{user?.firstName} {user?.lastName}</h1>
              <span className="badge bg-white/15 backdrop-blur-sm text-white flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> {ROLE_LABEL[user?.role] || 'Customer'}
              </span>
            </div>
            <p className="text-gray-300 text-sm mt-1 truncate">{user?.email}</p>
          </div>
        </div>
      </Reveal>

      {/* Stats — floated as their own cards, overlapping the header's bottom edge */}
      <Reveal delay={40} className="relative z-10 -mt-9 sm:-mt-10 mb-6">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <FloatingStat icon={Package} label="Orders" value={counts.orders} accent="navy" />
          <FloatingStat icon={Calendar} label="Bookings" value={counts.bookings} accent="teal" />
          <FloatingStat icon={Clock} label="Member Since" value={memberSince} text accent="orange" />
        </div>
      </Reveal>

      {/* Portal access — admins and employees only */}
      {(user?.role === 'admin' || user?.role === 'employee') && (
        <Reveal delay={90} className="mb-6">
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
        <Reveal as="nav" delay={130} className="card p-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible h-fit">
          {(user?.role === 'admin' || user?.role === 'employee') && (
            <Link
              to={user.role === 'admin' ? '/admin' : '/employee'}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition whitespace-nowrap text-brand-orange font-semibold hover:bg-orange-50 md:mb-1 md:pb-3 md:border-b md:border-gray-100"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-orange/10 text-brand-orange shrink-0">
                <LayoutDashboard className="w-3.5 h-3.5" />
              </span>
              {user.role === 'admin' ? 'Admin Portal' : 'Employee Portal'}
            </Link>
          )}
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap text-left ${tab === t.key ? 'bg-brand-navy/8 text-brand-navy font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-brand-navy'}`}
            >
              <span className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors shrink-0 ${tab === t.key ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-brand-navy/10 group-hover:text-brand-navy'}`}>
                <t.icon className="w-3.5 h-3.5" />
              </span>
              {t.label}
            </button>
          ))}
          <Link to="/orders" className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-600 hover:text-brand-navy text-sm transition-all whitespace-nowrap md:mt-1 md:pt-3 md:border-t md:border-gray-100">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-400 group-hover:bg-brand-navy/10 group-hover:text-brand-navy transition-colors shrink-0">
              <Package className="w-3.5 h-3.5" />
            </span>
            My Orders
          </Link>
          <Link to="/bookings" className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-600 hover:text-brand-navy text-sm transition-all whitespace-nowrap">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-400 group-hover:bg-brand-navy/10 group-hover:text-brand-navy transition-colors shrink-0">
              <Calendar className="w-3.5 h-3.5" />
            </span>
            My Bookings
          </Link>
          <button onClick={() => setConfirmLogout(true)} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-red-50 text-red-600 text-sm transition-all whitespace-nowrap md:mt-2 md:border-t md:pt-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 text-red-500 group-hover:bg-red-100 transition-colors shrink-0">
              <LogOut className="w-3.5 h-3.5" />
            </span>
            Log Out
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
        {loggingOut && <PageTransitionOverlay phase="in" />}

        {/* Active tab content */}
        <Reveal delay={180} className="card p-6">
          <ActiveTab />
        </Reveal>
      </div>
    </div>
  );
}

const STAT_ACCENTS = {
  navy: { bg: 'bg-brand-navy/10', text: 'text-brand-navy' },
  teal: { bg: 'bg-brand-teal/10', text: 'text-brand-teal' },
  orange: { bg: 'bg-brand-orange/10', text: 'text-brand-orange' },
};

function FloatingStat({ icon: Icon, label, value, text, accent }) {
  const { bg, text: textColor } = STAT_ACCENTS[accent];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-brand-navy/5 p-3.5 sm:p-5 flex flex-col items-center text-center sm:flex-row sm:text-left gap-2 sm:gap-3.5 hover:-translate-y-1 hover:shadow-xl transition-all">
      <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4.5 h-4.5 sm:w-5 sm:h-5 ${textColor}`} />
      </div>
      <div className="min-w-0">
        {value === null ? (
          <p className="font-display font-bold text-lg sm:text-xl text-brand-ink leading-tight">—</p>
        ) : text ? (
          <p className="font-display font-bold text-lg sm:text-xl text-brand-ink leading-tight truncate">{value}</p>
        ) : (
          <CountUp value={String(value)} className="font-display font-bold text-lg sm:text-xl text-brand-ink leading-tight tabular-nums" />
        )}
        <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
