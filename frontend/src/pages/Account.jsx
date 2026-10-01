import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  User, Package, Calendar, LogOut, ShieldCheck, ArrowRight, ArrowUpRight, Mail, Clock,
  MapPinned, CreditCard, Bell, Lock, Star, LayoutDashboard, LifeBuoy, PackageCheck,
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
import ReturnsTab from '../components/account/ReturnsTab';
import SupportTab from '../components/account/SupportTab';

const ROLE_LABEL = { customer: 'Customer', employee: 'Employee', admin: 'Administrator' };

// Wide on purpose: the account page uses the whole screen rather than a narrow centred column.
const CONTAINER = 'w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-10';

const TABS = [
  { key: 'profile', label: 'Profile Details', icon: User, Component: ProfileTab },
  { key: 'address', label: 'Address', icon: MapPinned, Component: AddressesTab },
  { key: 'payment', label: 'Payment', icon: CreditCard, Component: PaymentTab },
  { key: 'notifications', label: 'Notifications', icon: Bell, Component: NotificationsTab },
  { key: 'security', label: 'Security', icon: Lock, Component: SecurityTab },
  { key: 'reviews', label: 'Reviews', icon: Star, Component: ReviewsTab },
  { key: 'returns', label: 'Returns & Cancellations', icon: PackageCheck, Component: ReturnsTab },
  { key: 'support', label: 'Support', icon: LifeBuoy, Component: SupportTab },
];

// What a complete profile has — drives the "Profile" stat card's ring.
const PROFILE_CHECKS = [
  (u) => !!(u?.firstName && u?.lastName),
  (u) => !!u?.email,
  (u) => !!u?.phone,
  (u) => !!u?.address?.trim(),
  (u) => !!u?.twoFactorEnabled,
];

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
  // The tab lives in the URL (same arrangement as My Orders) so the "View this return" button in
  // a return email can deep-link to ?tab=returns instead of dropping the customer on Profile.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab = TABS.some(t => t.key === requestedTab) ? requestedTab : 'profile';
  const setTab = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'profile') next.delete('tab');
    else next.set('tab', key);
    setSearchParams(next, { replace: true });
  };
  // Kept whole (not just counted) so the Profile tab can show the next visit and latest order
  // without fetching both lists a second time. null until loaded.
  const [orders, setOrders] = useState(null);
  const [bookings, setBookings] = useState(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    api.get('/orders/my').then(setOrders).catch(() => setOrders([]));
    api.get('/bookings/my').then(setBookings).catch(() => setBookings([]));
  }, []);

  const handleLogout = () => {
    setConfirmLogout(false);
    setLoggingOut(true);
    setTimeout(() => { logout(); window.location.href = '/'; }, 600);
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';
  const profilePercent = Math.round((PROFILE_CHECKS.filter(check => check(user)).length / PROFILE_CHECKS.length) * 100);

  const ActiveTab = TABS.find(t => t.key === tab)?.Component || ProfileTab;
  const isStaff = user?.role === 'admin' || user?.role === 'employee';

  return (
    <div className="pb-16">
      {/* Header — a full-width band. The faint grid fades in toward the right edge only. */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy via-brand-blue to-brand-navy text-white">
        <div aria-hidden="true" className="account-hero-grid absolute inset-0 pointer-events-none" />
        <div aria-hidden="true" className="float-blob absolute -top-32 left-1/3 w-80 h-80 bg-brand-orange/10 rounded-full blur-3xl pointer-events-none" />
        <div aria-hidden="true" className="float-blob-delayed absolute -bottom-40 right-[10%] w-[28rem] h-[28rem] bg-brand-teal/20 rounded-full blur-3xl pointer-events-none" />
        <Reveal className={`${CONTAINER} relative pt-10 sm:pt-12 pb-24 sm:pb-28`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white text-brand-navy flex items-center justify-center text-2xl sm:text-3xl font-display font-extrabold ring-4 ring-white/15 shadow-xl shadow-black/20 shrink-0">
              {initials(user?.firstName, user?.lastName)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-orange mb-2">{greeting()}</p>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight [overflow-wrap:anywhere]">
                {user?.firstName} {user?.lastName}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/70">
                <span className="badge bg-white/15 backdrop-blur-sm text-white gap-1">
                  <ShieldCheck className="w-3 h-3" /> {ROLE_LABEL[user?.role] || 'Customer'}
                </span>
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{user?.email}</span>
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Stats — floated as their own cards, overlapping the header's bottom edge */}
      <Reveal delay={40} className={`${CONTAINER} relative z-10 -mt-14 sm:-mt-16`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={Package} label="Orders" value={orders ? orders.length : null} count to="/orders" accent="navy" />
          <StatCard icon={Calendar} label="Bookings" value={bookings ? bookings.length : null} count to="/bookings" accent="teal" />
          <StatCard icon={Clock} label="Member Since" value={memberSince} accent="orange" />
          <StatCard ring={profilePercent} label="Profile Complete" value={`${profilePercent}%`} accent="teal" />
        </div>
      </Reveal>

      <div className={`${CONTAINER} mt-6`}>
        {/* Portal access — admins and employees only */}
        {isStaff && (
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

        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
          {/* Sidebar — a scrolling strip on phones and tablets, a list from lg up */}
          <Reveal as="nav" delay={130} aria-label="Account" className="card p-2 lg:p-3 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible no-scrollbar h-fit">
            {isStaff && (
              <Link
                to={user.role === 'admin' ? '/admin' : '/employee'}
                className={`${NAV_ITEM} text-brand-orange font-semibold hover:bg-orange-50 lg:mb-1 lg:pb-3 lg:border-b lg:border-gray-100`}
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-orange/10 text-brand-orange shrink-0">
                  <LayoutDashboard className="w-4 h-4" />
                </span>
                {user.role === 'admin' ? 'Admin Portal' : 'Employee Portal'}
              </Link>
            )}
            {TABS.map(t => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  aria-current={active ? 'page' : undefined}
                  className={`${NAV_ITEM} text-left ${active ? 'bg-brand-navy/[0.06] text-brand-navy font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-brand-navy'}`}
                >
                  <span className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors shrink-0 ${active ? 'bg-brand-navy text-white shadow-sm shadow-brand-navy/30' : 'bg-gray-100 text-gray-400 group-hover:bg-brand-navy/10 group-hover:text-brand-navy'}`}>
                    <t.icon className="w-4 h-4" />
                  </span>
                  {t.label}
                </button>
              );
            })}
            <div className="hidden lg:block mx-3 my-2 border-t border-gray-100" />
            <Link to="/orders" className={`${NAV_ITEM} text-gray-600 hover:bg-gray-50 hover:text-brand-navy`}>
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-400 group-hover:bg-brand-navy/10 group-hover:text-brand-navy transition-colors shrink-0">
                <Package className="w-4 h-4" />
              </span>
              My Orders
            </Link>
            <Link to="/bookings" className={`${NAV_ITEM} text-gray-600 hover:bg-gray-50 hover:text-brand-navy`}>
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-400 group-hover:bg-brand-navy/10 group-hover:text-brand-navy transition-colors shrink-0">
                <Calendar className="w-4 h-4" />
              </span>
              My Bookings
            </Link>
            <div className="hidden lg:block mx-3 my-2 border-t border-gray-100" />
            <button onClick={() => setConfirmLogout(true)} className={`${NAV_ITEM} text-red-600 hover:bg-red-50`}>
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-500 group-hover:bg-red-100 transition-colors shrink-0">
                <LogOut className="w-4 h-4" />
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
          <Reveal delay={180} className="card p-6 sm:p-8">
            <ActiveTab orders={orders} bookings={bookings} />
          </Reveal>
        </div>
      </div>
    </div>
  );
}

const NAV_ITEM = 'group flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm transition-all whitespace-nowrap';

const STAT_ACCENTS = {
  navy: { bg: 'bg-brand-navy/10', text: 'text-brand-navy', bar: 'bg-brand-navy' },
  teal: { bg: 'bg-brand-teal/10', text: 'text-brand-teal', bar: 'bg-brand-teal' },
  orange: { bg: 'bg-brand-orange/10', text: 'text-brand-orange', bar: 'bg-brand-orange' },
};

// One floating stat card. `to` makes it a link, `count` animates a number, and `ring` swaps the
// icon for a small progress ring (0–100). A null value is still loading.
function StatCard({ icon: Icon, label, value, count, to, ring, accent }) {
  const { bg, text, bar } = STAT_ACCENTS[accent];
  const body = (
    <>
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${bar} opacity-0 group-hover:opacity-100 transition-opacity`} />
      {ring !== undefined ? (
        <ProgressRing percent={ring} className={text} />
      ) : (
        <span className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${text}`} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-display font-bold text-lg sm:text-2xl text-brand-ink leading-tight tabular-nums whitespace-nowrap">
          {value === null ? '—' : count ? <CountUp value={String(value)} /> : value}
        </span>
        <span className="block text-[11px] uppercase tracking-wide text-gray-400 mt-0.5 leading-tight">{label}</span>
      </span>
      {to && <ArrowUpRight className="hidden sm:block w-4 h-4 self-start text-gray-300 group-hover:text-brand-orange transition-colors shrink-0" />}
    </>
  );
  const cls = 'group relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-lg shadow-brand-navy/5 p-3.5 sm:p-5 flex items-center gap-2.5 sm:gap-4';
  return to
    ? <Link to={to} className={`${cls} hover:-translate-y-1 hover:shadow-xl transition-all`}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

function ProgressRing({ percent, className = '' }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 48 48" className={`w-9 h-9 sm:w-12 sm:h-12 -rotate-90 shrink-0 ${className}`} aria-hidden="true">
      <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="5" />
      <circle
        cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} className="transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  );
}
