import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Wrench, ShoppingCart, Calendar, Users, Ticket, ShieldCheck, Settings,
  Search, Bell, Home, LogOut, History, LifeBuoy, X, User, ClipboardCheck, Truck, UserCog,
  HardHat, MessageSquare, CheckCircle, BarChart3, FileText, SlidersHorizontal, KeyRound, PackageCheck,
  Menu, IdCard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import ConfirmDialog from './ConfirmDialog';
import { ACTION_META, timeAgo, parseUtc } from '../data/auditActions';
import { getStaffRole } from '../constants/staffRoles';
import { landingFor } from '../utils/staffLanding';

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/admin/reports', icon: BarChart3, label: 'Reports' },
      { to: '/admin/products', icon: Package, label: 'Products' },
      { to: '/admin/services', icon: Wrench, label: 'Services' },
      { to: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
      { to: '/admin/returns', icon: PackageCheck, label: 'Returns & Cancellations' },
      { to: '/admin/bookings', icon: Calendar, label: 'Bookings' },
      { to: '/admin/users', icon: Users, label: 'Users' },
      { to: '/admin/vouchers', icon: Ticket, label: 'Vouchers' },
      { to: '/admin/support', icon: LifeBuoy, label: 'Support' },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/admin/approvals', icon: ClipboardCheck, label: 'Approvals' },
      { to: '/admin/technicians', icon: HardHat, label: 'Technicians' },
      { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },
      { to: '/admin/hr/employees', icon: UserCog, label: 'Employees' },
      { to: '/admin/suppliers', icon: Truck, label: 'Suppliers' },
    ],
  },
  {
    label: 'Super Admin',
    items: [
      { to: '/admin/staff', icon: ShieldCheck, label: 'Admin Management' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/cms', icon: FileText, label: 'Content (CMS)' },
      { to: '/admin/settings', icon: SlidersHorizontal, label: 'Platform Settings' },
      { to: '/admin/audit-log', icon: History, label: 'Audit Trail' },
      { to: '/admin/profile', icon: Settings, label: 'Security & Settings' },
    ],
  },
];

// Which /admin/* pages a given employee position may see in the sidebar —
// mirrors the authorizeAdminOr() scoping enforced server-side in admin.js.
const POSITION_NAV_PATHS = {
  inventory_clerk: ['/admin/products', '/admin/services', '/admin/orders', '/admin/returns', '/admin/bookings', '/admin/vouchers', '/admin/support', '/admin/approvals'],
  general_staff: ['/admin/products', '/admin/services', '/admin/orders', '/admin/bookings', '/admin/vouchers', '/admin/support'],
  booking_coordinator: ['/admin/bookings', '/admin/technicians', '/admin/approvals'],
  hr: ['/admin/hr/employees', '/admin/suppliers', '/admin/approvals'],
  installer: [],
};

// Pages every employee gets on top of their position's own slice (including employees with
// no scoped position at all) — Messages holds the staff directory and the General channel.
const ALL_STAFF_NAV_PATHS = ['/admin/messages'];

// Every scoped position's own stats overview, injected ahead of their filtered
// NAV_SECTIONS items rather than living inside NAV_SECTIONS itself — admin
// already has its own /admin dashboard and doesn't need these four extra links.
const POSITION_DASHBOARD_ITEM = {
  inventory_clerk: { to: '/admin/products/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  general_staff: { to: '/admin/orders/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  booking_coordinator: { to: '/admin/bookings/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  hr: { to: '/admin/hr/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  // Installer has a scoped nav (just Messages, via POSITION_NAV_PATHS) but the job-assignment
  // page is still its actual landing page, so it reuses EMPLOYEE_DASHBOARD_ITEM below rather
  // than getting its own /dashboard route.
  installer: { to: '/employee', icon: Wrench, label: 'My Jobs', end: true },
};

// Positions with no scoped admin slice at all (no position set) get this as their only
// item instead — the job-assignment dashboard that's their actual landing page.
const EMPLOYEE_DASHBOARD_ITEM = { to: '/employee', icon: Wrench, label: 'My Jobs', end: true };

// Installer-only: a status table of their jobs plus the history of completions they've
// submitted for verification (including rejection notes) — sits right after "My Jobs".
const INSTALLER_JOB_STATUS_ITEM = { to: '/employee/job-status', icon: CheckCircle, label: 'Job Status', end: true };

function isNavItemActive(item, location) {
  const [path, queryString] = item.to.split('?');
  if (item.end) return location.pathname === path;
  if (location.pathname !== path) return false;
  const itemTab = queryString ? new URLSearchParams(queryString).get('tab') : null;
  const currentTab = new URLSearchParams(location.search).get('tab');
  return (itemTab || null) === (currentTab || null);
}

// The notification bell only surfaces these customer-initiated events (new purchase, booking,
// support message, return request) plus the two staff ones worth interrupting for — everything
// else staff/admins do is still recorded but only shown on the Audit Trail page.
const NOTIF_META = {
  'order.create': { Icon: ShoppingCart, className: 'bg-yellow-100 text-yellow-700', title: 'New Order', link: '/admin/orders' },
  'booking.create': { Icon: Calendar, className: 'bg-blue-100 text-blue-700', title: 'New Booking', link: '/admin/bookings' },
  'support.create': { Icon: LifeBuoy, className: 'bg-red-100 text-red-700', title: 'Support Message', link: '/admin/support' },
  'booking.completed': { Icon: CheckCircle, className: 'bg-green-100 text-green-700', title: 'Installation Completed', link: '/admin/bookings' },
  'auth.password_reset_request': { Icon: KeyRound, className: 'bg-amber-100 text-amber-700', title: 'Password Reset Request', link: '/admin/approvals' },
  'return.create': { Icon: PackageCheck, className: 'bg-orange-100 text-orange-700', title: 'Return Request', link: '/admin/returns' },
};

// Employees (booking coordinators, installers, ...) get their own personal notification
// feed from /notifications instead of the admin audit-log feed above — icon/color by type.
const EMPLOYEE_NOTIF_META = {
  'booking.assigned': { Icon: Calendar, className: 'bg-blue-100 text-blue-700' },
  'message.new': { Icon: MessageSquare, className: 'bg-teal-100 text-[#00806f]' },
  'booking.completed': { Icon: CheckCircle, className: 'bg-green-100 text-green-700' },
  'booking.complete_requested': { Icon: ClipboardCheck, className: 'bg-amber-100 text-amber-700' },
  'support.resolve_requested': { Icon: LifeBuoy, className: 'bg-amber-100 text-amber-700' },
  'support.resolved': { Icon: CheckCircle, className: 'bg-green-100 text-green-700' },
  'support.resolve_rejected': { Icon: LifeBuoy, className: 'bg-red-100 text-red-700' },
  'return.created': { Icon: PackageCheck, className: 'bg-orange-100 text-orange-700' },
};

const AVATAR_COLORS = ['bg-brand-navy', 'bg-brand-blue', 'bg-[#00806f]', 'bg-[#c8461a]'];

function avatarColor(seed) {
  const sum = [...(seed || 'A')].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function initials(first, last) {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || 'A';
}

function NotifRow({ n, onClick }) {
  return (
    <Link
      to={n.link}
      onClick={onClick}
      className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 transition hover:bg-gray-50 ${n.unread ? 'bg-[#00806f]/5' : ''}`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${n.className}`}>
        <n.Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-800 truncate">{n.title}</p>
        <p className="text-xs text-gray-500 truncate">{n.description}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{n.time}</p>
      </div>
      {n.unread && <span className="w-2 h-2 rounded-full bg-[#00806f] shrink-0 mt-1.5" />}
    </Link>
  );
}

// Every /admin/* page mounts its own <AdminLayout>, so React Router fully
// unmounts and remounts it on every navigation (there's no shared parent
// route keeping it alive) — a plain useState scroll position would reset to
// 0 each time. Stashing it in module scope survives that remount and
// useLayoutEffect restores it before paint, so the sidebar doesn't visibly
// snap back to the top when a nav link is clicked.
let cachedSidebarScrollTop = 0;

export default function AdminLayout({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef(null);
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activity, setActivity] = useState([]);
  const [employeeNotifs, setEmployeeNotifs] = useState([]);
  const [confirmLogout, setConfirmLogout] = useState(false);
  // Below lg the sidebar is a drawer. No need to close it on navigation — every page mounts
  // its own AdminLayout, so following a link starts the next page with it shut.
  const [navOpen, setNavOpen] = useState(false);
  const seenKey = `homelink_notif_seen_${user?.id || 'admin'}`;
  const workspace = getStaffRole(isAdmin ? 'admin' : user?.position);
  const today = new Date().toLocaleDateString('en-PH', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const [seenAt, setSeenAt] = useState(() => localStorage.getItem(seenKey) || '');

  // Employees only ever see the section(s) covering their own task; global search
  // stays admin-only, but the notification bell below now covers both — admin from
  // the audit-log feed, employees from their own personal /notifications feed.
  const navSections = useMemo(() => {
    if (isAdmin) return NAV_SECTIONS;
    const hasScopedPosition = Object.prototype.hasOwnProperty.call(POSITION_NAV_PATHS, user?.position);
    const mainAllowed = new Set([...(POSITION_NAV_PATHS[user?.position] || []), ...ALL_STAFF_NAV_PATHS]);
    const sections = [];
    // "Main" and "Management" are two visually separate groups for admin, but a
    // scoped employee's allowed items come from either — fold both into their
    // single "Main" section rather than splitting it the same way for them.
    const selectableItems = [
      ...(NAV_SECTIONS.find(s => s.label === 'Main')?.items || []),
      ...(NAV_SECTIONS.find(s => s.label === 'Management')?.items || []),
    ];
    const allowedItems = selectableItems.filter(item => mainAllowed.has(item.to));
    const mainItems = hasScopedPosition
      ? [
          ...(POSITION_DASHBOARD_ITEM[user?.position] ? [POSITION_DASHBOARD_ITEM[user.position]] : []),
          ...(user?.position === 'installer' ? [INSTALLER_JOB_STATUS_ITEM] : []),
          ...allowedItems,
        ]
      : [EMPLOYEE_DASHBOARD_ITEM, ...allowedItems];
    if (mainItems.length) sections.push({ label: 'Main', items: mainItems });
    return sections;
  }, [isAdmin, user?.position]);

  useLayoutEffect(() => {
    if (navRef.current) navRef.current.scrollTop = cachedSidebarScrollTop;
  }, []);

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setNavOpen(false); };
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [navOpen]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/admin/audit-logs?action=order.create,booking.create,support.create,booking.completed,auth.password_reset_request,return.create&limit=50').then(setActivity).catch(() => {});
  }, [isAdmin]);

  const loadEmployeeNotifs = () => api.get('/notifications').then(setEmployeeNotifs).catch(() => {});
  useEffect(() => {
    if (isAdmin) return;
    loadEmployeeNotifs();
  }, [isAdmin]);

  // Mark the currently-loaded activity as seen once the panel is closed again,
  // so items stay flagged unread for the whole viewing session and only
  // clear the next time the panel is reopened. Admin's audit-log feed has no
  // per-item read state, so it's tracked client-side via a seen-at timestamp;
  // employees' own /notifications rows are real records, so those get marked
  // read server-side instead.
  useEffect(() => {
    if (!isAdmin || !notifOpen) return undefined;
    return () => {
      const now = new Date().toISOString();
      localStorage.setItem(seenKey, now);
      setSeenAt(now);
    };
  }, [isAdmin, notifOpen, seenKey]);

  useEffect(() => {
    if (isAdmin || !notifOpen) return undefined;
    return () => {
      if (employeeNotifs.some(n => !n.is_read)) {
        api.put('/notifications/read-all').catch(() => {});
        setEmployeeNotifs(items => items.map(n => ({ ...n, is_read: true })));
      }
    };
  }, [isAdmin, notifOpen, employeeNotifs]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    navigate(`/admin/products?search=${encodeURIComponent(search.trim())}`);
  };

  const handleLogout = () => { logout(); navigate('/admin/login'); };

  const notifItems = useMemo(() => activity.map(log => {
    const meta = ACTION_META[log.action];
    const { Icon, className, title, link } = NOTIF_META[log.action] || { Icon: Bell, className: 'bg-gray-100 text-gray-600', title: 'Activity', link: '/admin/audit-log' };
    return {
      id: log.id,
      Icon,
      className,
      title,
      description: meta && log.details ? meta.describe(log.details) : log.action,
      time: timeAgo(log.created_at),
      link,
      unread: !seenAt || parseUtc(log.created_at).toISOString() > seenAt,
    };
  }), [activity, seenAt]);

  const employeeNotifItems = useMemo(() => employeeNotifs.map(n => {
    const { Icon, className } = EMPLOYEE_NOTIF_META[n.type] || { Icon: Bell, className: 'bg-gray-100 text-gray-600' };
    return {
      id: n.id,
      Icon,
      className,
      title: n.title,
      description: n.message,
      time: timeAgo(n.created_at),
      link: n.link || '/employee',
      unread: !n.is_read,
    };
  }), [employeeNotifs]);

  const bellItems = isAdmin ? notifItems : employeeNotifItems;
  const bellCount = bellItems.filter(a => a.unread).length;

  return (
    // Normally one screen tall at minimum; while a Select dropdown hangs past the bottom of the
    // page, it publishes how tall the page needs to be so the background and sticky sidebar
    // stretch over the extra scroll room instead of leaving a bare strip below them.
    <div className="admin-shell flex" style={{ minHeight: 'max(100vh, var(--select-panel-page-min-height, 0px))' }}>
      {navOpen && <button type="button" aria-label="Close menu" onClick={() => setNavOpen(false)} className="fixed inset-0 z-40 bg-brand-navy/50 backdrop-blur-[2px] lg:hidden" />}

      {/* Sidebar — a drawer below lg, pinned beside the page from lg up. */}
      <aside
        id="admin-sidebar"
        className={`admin-sidebar w-64 shrink-0 h-screen fixed inset-y-0 left-0 z-50 text-white flex flex-col transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 ${navOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-2.5 px-5 h-16 shrink-0">
          <Link to={landingFor(user) || '/admin'} className="flex items-center gap-2.5 min-w-0" title="Go to your dashboard">
            <span className="w-8 h-8 bg-brand-orange rounded-lg flex items-center justify-center shrink-0"><Home className="w-4 h-4" /></span>
            <span className="font-display font-extrabold text-lg tracking-tight truncate">Home<span className="text-brand-orange">Link</span></span>
          </Link>
          <button type="button" onClick={() => setNavOpen(false)} aria-label="Close menu" className="ml-auto p-1.5 rounded-lg text-[#9db8e6] hover:text-white hover:bg-white/10 transition lg:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* The workspace picked at sign-in — the same room the staff portal lit up. */}
        <div className="mx-3 mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
          <span className="w-9 h-9 rounded-lg bg-brand-orange/15 text-[#ff8a5c] flex items-center justify-center shrink-0">
            {workspace ? <workspace.icon className="w-[18px] h-[18px]" /> : <IdCard className="w-[18px] h-[18px]" />}
          </span>
          <div className="min-w-0">
            <p className="drafting text-[10px] text-[#9db8e6]">{workspace?.room || 'Staff'}</p>
            <p className="text-sm font-semibold truncate">{workspace?.title || 'Employee'}</p>
          </div>
        </div>

        <nav
          ref={navRef}
          aria-label="Admin"
          onScroll={() => { cachedSidebarScrollTop = navRef.current.scrollTop; }}
          className="flex-1 px-3 py-3 overflow-y-auto scrollbar-ghost"
        >
          {navSections.map((section, i) => (
            <div key={section.label} className={i > 0 ? 'mt-5' : ''}>
              <p className="drafting px-3 mb-1.5 text-[10px] text-[#9db8e6]/70">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map(l => {
                  const active = isNavItemActive(l, location);
                  return (
                    <Link
                      key={l.to}
                      to={l.to}
                      aria-current={active ? 'page' : undefined}
                      className={`admin-nav-link flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${active ? 'font-semibold' : ''}`}
                    >
                      <l.icon className="w-4 h-4 shrink-0" /> {l.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10 shrink-0 flex items-center gap-1">
          <Link to={isAdmin ? '/admin/profile' : '/employee/profile'} className="flex-1 min-w-0 flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition">
            <div className={`w-8 h-8 rounded-lg ${avatarColor(user?.id)} flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden`}>
              {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : initials(user?.firstName, user?.lastName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-[#9db8e6] truncate">View profile</p>
            </div>
          </Link>
          <button onClick={() => setConfirmLogout(true)} title="Log out" aria-label="Log out" className="p-2.5 rounded-lg text-[#9db8e6] hover:bg-white/10 hover:text-white transition shrink-0">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmLogout}
        icon={LogOut}
        tone="login"
        title="Log out?"
        message="You'll need to sign in again to access the staff portal."
        confirmLabel="Log Out"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />

      {viewAllOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="modal-scrim" onClick={() => setViewAllOpen(false)} />
          <div className="modal-panel w-full max-w-lg max-h-[80vh] flex flex-col fade-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-display font-semibold text-lg text-brand-navy">All Notifications</h3>
              <button onClick={() => setViewAllOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {bellItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">You're all caught up.</p>
              ) : bellItems.map(n => (
                <NotifRow key={n.id} n={n} onClick={() => setViewAllOpen(false)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        {/* Solid, not frosted: a backdrop-filter here would become the containing block for the
            dropdowns' position:fixed click-outside layers and shrink them to this bar. */}
        <div className="h-16 shrink-0 sticky top-0 z-30 bg-white border-b border-[#e4e8f0] flex items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            aria-controls="admin-sidebar"
            aria-expanded={navOpen}
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 transition lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
          {isAdmin ? (
            <form onSubmit={handleSearch} className="relative flex-1 max-w-sm" role="search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                aria-label="Search products"
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-brand-orange focus:border-transparent outline-none transition"
              />
            </form>
          ) : <div className="flex-1" />}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <p className="drafting hidden md:block text-[11px] text-gray-500 pr-2 mr-1 border-r border-gray-200">{today}</p>
            <div className="relative">
              <button onClick={() => setNotifOpen(o => !o)} className="relative p-2 rounded-lg hover:bg-gray-100 transition" aria-label="Notifications">
                <Bell className="w-5 h-5 text-gray-500" />
                {bellCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-orange rounded-full" />}
              </button>
              {notifOpen && (
                <>
                  <button className="fixed inset-0 z-10 cursor-default" onClick={() => setNotifOpen(false)} aria-label="Close notifications" />
                  <div className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96 card p-0 z-20 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">Notifications</h3>
                      {bellCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-[#00806f] text-white text-[11px] font-bold flex items-center justify-center">{bellCount}</span>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {bellItems.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">You're all caught up.</p>
                      ) : bellItems.slice(0, 8).map(n => (
                        <NotifRow key={n.id} n={n} onClick={() => setNotifOpen(false)} />
                      ))}
                    </div>
                    <button
                      onClick={() => { setNotifOpen(false); setViewAllOpen(true); }}
                      className="block w-full text-center text-sm font-semibold text-[#00806f] hover:text-brand-navy transition py-3 border-t border-gray-100"
                    >
                      View All Notifications
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="relative">
              <button onClick={() => setProfileOpen(o => !o)} className={`w-9 h-9 rounded-full ${avatarColor(user?.id)} flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden`}>
                {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : initials(user?.firstName, user?.lastName)}
              </button>
              {profileOpen && (
                <>
                  <button className="fixed inset-0 z-10 cursor-default" onClick={() => setProfileOpen(false)} aria-label="Close profile menu" />
                  <div className="absolute right-0 mt-2 w-48 card p-1.5 z-20">
                    <Link to={isAdmin ? '/admin/profile' : '/employee/profile'} onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
                      <User className="w-4 h-4 text-gray-400" /> View Profile
                    </Link>
                    <Link to="/" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
                      <Home className="w-4 h-4 text-gray-400" /> View Website
                    </Link>
                    <div className="my-1 border-t border-gray-100" />
                    <button onClick={() => { setProfileOpen(false); setConfirmLogout(true); }} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition w-full">
                      <LogOut className="w-4 h-4 text-red-400" /> Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {title && (
          <header className="admin-page-head shrink-0 px-4 sm:px-6 lg:px-8 pt-7 pb-1">
            <h1 className="font-display text-[1.75rem] sm:text-3xl font-extrabold tracking-tight text-brand-ink">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 mt-1.5 max-w-2xl">{subtitle}</p>}
          </header>
        )}

        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
