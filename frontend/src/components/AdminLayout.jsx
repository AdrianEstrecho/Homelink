import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Wrench, ShoppingCart, Calendar, Users, Ticket, ShieldCheck, Settings,
  Search, Bell, Home, LogOut, History, LifeBuoy, X, User, ClipboardCheck, Wallet, Truck, UserCog, PieChart,
  HardHat, MessageSquare, CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import ConfirmDialog from './ConfirmDialog';
import { ACTION_META, timeAgo } from '../data/auditActions';

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/admin/products', icon: Package, label: 'Product' },
      { to: '/admin/services', icon: Wrench, label: 'Service' },
      { to: '/admin/orders', icon: ShoppingCart, label: 'Order' },
      { to: '/admin/bookings', icon: Calendar, label: 'Booking' },
      { to: '/admin/users', icon: Users, label: 'User' },
      { to: '/admin/vouchers', icon: Ticket, label: 'Voucher' },
      { to: '/admin/support', icon: LifeBuoy, label: 'Support' },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/admin/approvals', icon: ClipboardCheck, label: 'Approvals' },
      { to: '/admin/payroll', icon: Wallet, label: 'Payroll' },
      { to: '/admin/payroll/revenue', icon: PieChart, label: 'Revenue Sources' },
      { to: '/admin/technicians', icon: HardHat, label: 'Technicians' },
      { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },
      { to: '/admin/hr/employees', icon: UserCog, label: 'Employees' },
      { to: '/admin/suppliers', icon: Truck, label: 'Suppliers' },
    ],
  },
  {
    label: 'Archive',
    items: [
      { to: '/admin/products?tab=archived', icon: Package, label: 'Archived Products' },
      { to: '/admin/services?tab=archived', icon: Wrench, label: 'Archived Services' },
      { to: '/admin/archived-users', icon: Users, label: 'Archived Users' },
      { to: '/admin/hr/employees/archived', icon: UserCog, label: 'Archived Employees' },
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
      { to: '/admin/audit-log', icon: History, label: 'Audit Trail' },
      { to: '/admin/profile', icon: Settings, label: 'Security & Settings' },
    ],
  },
];

// Which /admin/* pages a given employee position may see in the sidebar —
// mirrors the authorizeAdminOr() scoping enforced server-side in admin.js.
const POSITION_NAV_PATHS = {
  inventory_clerk: ['/admin/products', '/admin/services', '/admin/orders', '/admin/bookings', '/admin/vouchers', '/admin/support', '/admin/approvals'],
  general_staff: ['/admin/products', '/admin/services', '/admin/orders', '/admin/bookings', '/admin/vouchers', '/admin/support'],
  booking_coordinator: ['/admin/bookings', '/admin/technicians', '/admin/messages', '/admin/approvals'],
  accounting: ['/admin/payroll', '/admin/payroll/revenue'],
  hr: ['/admin/hr/employees', '/admin/suppliers'],
  installer: ['/admin/messages'],
};

// Archive-section pages a position may see — kept separate from POSITION_NAV_PATHS
// since it maps to the "Archive" NAV_SECTIONS group rather than "Main".
const POSITION_ARCHIVE_PATHS = {
  inventory_clerk: ['/admin/products?tab=archived', '/admin/services?tab=archived'],
  general_staff: ['/admin/products?tab=archived', '/admin/services?tab=archived'],
  hr: ['/admin/hr/employees/archived'],
};

// Every scoped position's own stats overview, injected ahead of their filtered
// NAV_SECTIONS items rather than living inside NAV_SECTIONS itself — admin
// already has its own /admin dashboard and doesn't need these four extra links.
const POSITION_DASHBOARD_ITEM = {
  inventory_clerk: { to: '/admin/products/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  general_staff: { to: '/admin/orders/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  booking_coordinator: { to: '/admin/bookings/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  accounting: { to: '/admin/payroll/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
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

// The notification bell only ever surfaces these three customer-initiated
// events (new purchase, new booking, new support message) — everything else
// staff/admins do is still recorded but only shown on the Audit Trail page.
const NOTIF_META = {
  'order.create': { Icon: ShoppingCart, className: 'bg-yellow-100 text-yellow-700', title: 'New Order', link: '/admin/orders' },
  'booking.create': { Icon: Calendar, className: 'bg-blue-100 text-blue-700', title: 'New Booking', link: '/admin/bookings' },
  'support.create': { Icon: LifeBuoy, className: 'bg-red-100 text-red-700', title: 'Support Message', link: '/admin/support' },
  'booking.completed': { Icon: CheckCircle, className: 'bg-green-100 text-green-700', title: 'Installation Completed', link: '/admin/bookings' },
};

// Employees (booking coordinators, installers, ...) get their own personal notification
// feed from /notifications instead of the admin audit-log feed above — icon/color by type.
const EMPLOYEE_NOTIF_META = {
  'booking.assigned': { Icon: Calendar, className: 'bg-blue-100 text-blue-700' },
  'message.new': { Icon: MessageSquare, className: 'bg-teal-100 text-[#00806f]' },
  'booking.completed': { Icon: CheckCircle, className: 'bg-green-100 text-green-700' },
  'booking.complete_requested': { Icon: ClipboardCheck, className: 'bg-amber-100 text-amber-700' },
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
  const seenKey = `homelink_notif_seen_${user?.id || 'admin'}`;
  const [seenAt, setSeenAt] = useState(() => localStorage.getItem(seenKey) || '');

  // Employees only ever see the section(s) covering their own task; global search
  // stays admin-only, but the notification bell below now covers both — admin from
  // the audit-log feed, employees from their own personal /notifications feed.
  const navSections = useMemo(() => {
    if (isAdmin) return NAV_SECTIONS;
    const hasScopedPosition = Object.prototype.hasOwnProperty.call(POSITION_NAV_PATHS, user?.position);
    const mainAllowed = new Set(POSITION_NAV_PATHS[user?.position] || []);
    const archiveAllowed = new Set(POSITION_ARCHIVE_PATHS[user?.position] || []);
    const sections = [];
    // "Main" and "Management" are two visually separate groups for admin, but a
    // scoped employee's allowed items come from either — fold both into their
    // single "Main" section rather than splitting it the same way for them.
    const selectableItems = [
      ...(NAV_SECTIONS.find(s => s.label === 'Main')?.items || []),
      ...(NAV_SECTIONS.find(s => s.label === 'Management')?.items || []),
    ];
    const mainItems = hasScopedPosition
      ? [
          ...(POSITION_DASHBOARD_ITEM[user?.position] ? [POSITION_DASHBOARD_ITEM[user.position]] : []),
          ...(user?.position === 'installer' ? [INSTALLER_JOB_STATUS_ITEM] : []),
          ...selectableItems.filter(item => mainAllowed.has(item.to)),
        ]
      : [EMPLOYEE_DASHBOARD_ITEM];
    if (mainItems.length) sections.push({ label: 'Main', items: mainItems });
    const archiveItems = (NAV_SECTIONS.find(s => s.label === 'Archive')?.items || []).filter(item => archiveAllowed.has(item.to));
    if (archiveItems.length) sections.push({ label: 'Archive', items: archiveItems });
    return sections;
  }, [isAdmin, user?.position]);

  useLayoutEffect(() => {
    if (navRef.current) navRef.current.scrollTop = cachedSidebarScrollTop;
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/admin/audit-logs?action=order.create,booking.create,support.create,booking.completed&limit=50').then(setActivity).catch(() => {});
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
      unread: !seenAt || new Date(`${log.created_at.replace(' ', 'T')}Z`).toISOString() > seenAt,
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
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 h-screen sticky top-0 bg-brand-navy text-white flex flex-col">
        <div className="flex items-center gap-2 px-5 h-16 border-b border-white/10 shrink-0">
          <div className="w-8 h-8 bg-brand-orange rounded-lg flex items-center justify-center shrink-0"><Home className="w-4 h-4" /></div>
          <span className="font-display font-bold text-lg truncate">Home<span className="text-brand-orange">Link</span></span>
        </div>
        <nav
          ref={navRef}
          onScroll={() => { cachedSidebarScrollTop = navRef.current.scrollTop; }}
          className="flex-1 px-3 py-4 overflow-y-auto scrollbar-ghost"
        >
          {navSections.map((section, i) => (
            <div key={section.label} className={i > 0 ? 'mt-5' : ''}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{section.label}</p>
              <div className="space-y-1">
                {section.items.map(l => {
                  const active = isNavItemActive(l, location);
                  return (
                    <Link
                      key={l.to}
                      to={l.to}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${active ? 'bg-white/10 text-white font-semibold' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                    >
                      <l.icon className="w-4 h-4 shrink-0" /> {l.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 shrink-0">
          <Link to={isAdmin ? '/admin/profile' : '/employee/profile'} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition">
            <div className={`w-8 h-8 rounded-lg ${avatarColor(user?.id)} flex items-center justify-center text-xs font-bold shrink-0`}>
              {initials(user?.firstName, user?.lastName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gray-400 truncate">My Profile</p>
            </div>
          </Link>
          <button onClick={() => setConfirmLogout(true)} className="flex items-center gap-2.5 px-2 py-2 mt-1 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition w-full">
            <LogOut className="w-4 h-4 shrink-0" /> Log Out
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
        <div className="h-16 shrink-0 bg-white border-b border-gray-100 flex items-center gap-4 px-6">
          {isAdmin ? (
            <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent outline-none transition"
              />
            </form>
          ) : <div className="flex-1" />}
          <div className="flex items-center gap-3 ml-auto">
            <div className="relative">
              <button onClick={() => setNotifOpen(o => !o)} className="relative p-2 rounded-lg hover:bg-gray-100 transition" aria-label="Notifications">
                <Bell className="w-5 h-5 text-gray-500" />
                {bellCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-orange rounded-full" />}
              </button>
              {notifOpen && (
                <>
                  <button className="fixed inset-0 z-10 cursor-default" onClick={() => setNotifOpen(false)} aria-label="Close notifications" />
                  <div className="absolute right-0 mt-2 w-96 card p-0 z-20 overflow-hidden">
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
              <button onClick={() => setProfileOpen(o => !o)} className={`w-9 h-9 rounded-full ${avatarColor(user?.id)} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                {initials(user?.firstName, user?.lastName)}
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

        {/* Banner */}
        {title && (
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-navy via-brand-blue to-brand-navy text-white px-6 py-8 shrink-0">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="float-blob absolute -top-10 -left-10 w-56 h-56 bg-brand-orange rounded-full blur-3xl" />
              <div className="float-blob-delayed absolute -bottom-16 right-0 w-64 h-64 bg-brand-teal rounded-full blur-3xl" />
            </div>
            <div className="relative">
              <h1 className="font-display text-2xl sm:text-3xl font-bold">{title}</h1>
              {subtitle && <p className="text-gray-300 text-sm mt-1.5">{subtitle}</p>}
            </div>
          </div>
        )}

        <div className="flex-1 p-6 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
