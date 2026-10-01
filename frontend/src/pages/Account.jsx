import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  User, Package, Calendar, LogOut, ShieldCheck, ArrowRight, ArrowUpRight, Mail,
  MapPinned, CreditCard, Bell, Lock, Star, LayoutDashboard, LifeBuoy, PackageCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import Reveal from '../components/Reveal';
import CountUp from '../components/CountUp';
import ConfirmDialog from '../components/ConfirmDialog';
import PageTransitionOverlay from '../components/PageTransitionOverlay';
import BlueprintHouse from '../components/account/BlueprintHouse';
import ProfileTab from '../components/account/ProfileTab';
import AddressesTab from '../components/account/AddressesTab';
import PaymentTab from '../components/account/PaymentTab';
import NotificationsTab from '../components/account/NotificationsTab';
import SecurityTab from '../components/account/SecurityTab';
import ReviewsTab from '../components/account/ReviewsTab';
import ReturnsTab from '../components/account/ReturnsTab';
import SupportTab from '../components/account/SupportTab';

const ROLE_LABEL = { customer: 'Customer', employee: 'Employee', admin: 'Administrator' };

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

  // The drawing title under the header's house: "Estrecho Residence", the way a plan is named
  // after the family it was drawn for.
  const residence = `${user?.lastName || user?.firstName || 'Your'} Residence`;

  const ActiveTab = TABS.find(t => t.key === tab)?.Component || ProfileTab;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header — a blueprint sheet: who you are on the left, your house drafted on the right,
          and the account's numbers in a title block along the bottom edge. */}
      <Reveal className="blueprint-sheet relative overflow-hidden rounded-2xl text-white shadow-xl shadow-brand-navy/15 mb-6">
        <div className="flex items-center gap-6 px-6 sm:px-8 pt-7 sm:pt-8 pb-6 md:py-5">
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7">
            <div className="w-20 h-20 rounded-full bg-white text-brand-navy flex items-center justify-center text-2xl font-display font-extrabold [font-stretch:112%] shadow-xl shadow-black/25 shrink-0 outline-dashed outline-1 outline-white/45 outline-offset-[6px]">
              {initials(user?.firstName, user?.lastName)}
            </div>
            <div className="min-w-0">
              <p className="drafting-label text-brand-orange mb-2">{greeting()}</p>
              <h1 className="font-display text-[1.75rem] sm:text-[2.1rem] font-bold leading-[1.05] tracking-tight [font-stretch:112%] [overflow-wrap:anywhere]">
                {user?.firstName} {user?.lastName}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/65">
                <span className="drafting-label inline-flex items-center gap-1.5 rounded-full border border-white/25 px-2.5 py-1 text-white/85">
                  <ShieldCheck className="w-3 h-3" /> {ROLE_LABEL[user?.role] || 'Customer'}
                </span>
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{user?.email}</span>
                </span>
              </div>
            </div>
          </div>
          <BlueprintHouse title={residence} className="hidden md:block shrink-0" />
        </div>

        {/* Title block */}
        <div className="grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 bg-[#081a3d]/50">
          <TitleCell label="Orders" to="/orders" value={orders ? orders.length : null} count />
          <TitleCell label="Bookings" to="/bookings" value={bookings ? bookings.length : null} count />
          <TitleCell label="Member since" value={memberSince} />
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

      <div className="grid grid-cols-1 md:grid-cols-[236px_1fr] gap-6">
        {/* Sidebar — a horizontal strip on phones, a grouped list from md up */}
        <Reveal as="nav" delay={130} aria-label="Account" className="card p-2 md:p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible no-scrollbar h-fit">
          {(user?.role === 'admin' || user?.role === 'employee') && (
            <Link
              to={user.role === 'admin' ? '/admin' : '/employee'}
              className={`${NAV_ITEM} text-brand-orange font-semibold hover:bg-orange-50 md:mb-2`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              {user.role === 'admin' ? 'Admin Portal' : 'Employee Portal'}
            </Link>
          )}
          <p className="hidden md:block drafting-label text-gray-400 px-3 pt-1 pb-2">Settings</p>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-current={active ? 'page' : undefined}
                className={`${NAV_ITEM} text-left ${active ? 'bg-brand-navy text-white font-semibold shadow-sm shadow-brand-navy/20' : 'text-gray-600 hover:bg-brand-navy/[0.05] hover:text-brand-navy'}`}
              >
                <t.icon className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-brand-orange' : 'text-gray-400 group-hover:text-brand-navy'}`} />
                {t.label}
              </button>
            );
          })}
          <div className="hidden md:block mx-3 my-2 border-t border-dashed border-gray-200" />
          <p className="hidden md:block drafting-label text-gray-400 px-3 pt-1 pb-2">Activity</p>
          <Link to="/orders" className={`${NAV_ITEM} text-gray-600 hover:bg-brand-navy/[0.05] hover:text-brand-navy`}>
            <Package className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-brand-navy transition-colors" />
            My Orders
            <ArrowUpRight className="hidden md:block w-3.5 h-3.5 ml-auto text-gray-300 group-hover:text-brand-orange transition-colors" />
          </Link>
          <Link to="/bookings" className={`${NAV_ITEM} text-gray-600 hover:bg-brand-navy/[0.05] hover:text-brand-navy`}>
            <Calendar className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-brand-navy transition-colors" />
            My Bookings
            <ArrowUpRight className="hidden md:block w-3.5 h-3.5 ml-auto text-gray-300 group-hover:text-brand-orange transition-colors" />
          </Link>
          <div className="hidden md:block mx-3 my-2 border-t border-dashed border-gray-200" />
          <button onClick={() => setConfirmLogout(true)} className={`${NAV_ITEM} text-red-600 hover:bg-red-50`}>
            <LogOut className="w-4 h-4 shrink-0" />
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
  );
}

const NAV_ITEM = 'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap';

// One cell of the header's title block. Orders and bookings link through to their own pages;
// a null value is still loading.
function TitleCell({ label, value, to, count }) {
  const body = (
    <>
      <span className="drafting-label flex items-center justify-between gap-2 text-white/50">
        {label}
        {to && <ArrowUpRight className="w-3.5 h-3.5 text-white/30 transition group-hover:text-brand-orange group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
      </span>
      <span className="mt-2 block font-display text-lg sm:text-2xl font-bold leading-none tabular-nums whitespace-nowrap sm:[font-stretch:108%]">
        {value === null ? <span className="text-white/35">—</span> : count ? <CountUp value={String(value)} /> : value}
      </span>
    </>
  );
  const cls = 'group min-w-0 flex flex-col justify-between px-3.5 sm:px-8 py-4 sm:py-5';
  return to
    ? <Link to={to} className={`${cls} transition-colors hover:bg-white/[0.05]`}>{body}</Link>
    : <div className={cls}>{body}</div>;
}
