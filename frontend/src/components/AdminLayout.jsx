import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Wrench, ShoppingCart, Calendar, Users, Ticket, ShieldCheck, Settings,
  Search, Bell, Home, LogOut, History, AlertTriangle, Plus, Pencil, Trash2, LogIn, Archive,
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
    ],
  },
  {
    label: 'Archive',
    items: [
      { to: '/admin/products?tab=archived', icon: Package, label: 'Archived Products' },
      { to: '/admin/services?tab=archived', icon: Wrench, label: 'Archived Services' },
      { to: '/admin/archived-users', icon: Users, label: 'Archived Users' },
      { to: '/admin/orders?tab=cancelled', icon: ShoppingCart, label: 'Archived Orders' },
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

function isNavItemActive(item, location) {
  const [path, queryString] = item.to.split('?');
  if (item.end) return location.pathname === path;
  if (location.pathname !== path) return false;
  const itemTab = queryString ? new URLSearchParams(queryString).get('tab') : null;
  const currentTab = new URLSearchParams(location.search).get('tab');
  return (itemTab || null) === (currentTab || null);
}

const CATEGORY_ICON = {
  create: { Icon: Plus, className: 'bg-green-100 text-green-600' },
  update: { Icon: Pencil, className: 'bg-amber-100 text-amber-600' },
  delete: { Icon: Trash2, className: 'bg-red-100 text-red-600' },
  login: { Icon: LogIn, className: 'bg-blue-100 text-blue-600' },
  archive: { Icon: Archive, className: 'bg-purple-100 text-purple-600' },
};
const CATEGORY_VERB = { create: 'Created', update: 'Updated', delete: 'Deleted', login: 'Logged In', archive: 'Archived' };

const AVATAR_COLORS = ['bg-brand-navy', 'bg-brand-blue', 'bg-[#00806f]', 'bg-[#c8461a]'];

function avatarColor(seed) {
  const sum = [...(seed || 'A')].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function initials(first, last) {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || 'A';
}

export default function AdminLayout({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [activity, setActivity] = useState([]);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const seenKey = `homelink_notif_seen_${user?.id || 'admin'}`;
  const [seenAt, setSeenAt] = useState(() => localStorage.getItem(seenKey) || '');

  useEffect(() => {
    api.get('/admin/notifications-summary').then(setSummary).catch(() => {});
    api.get('/admin/audit-logs?limit=5').then(setActivity).catch(() => {});
  }, []);

  // Mark the currently-loaded activity as seen once the panel is closed again,
  // so items stay flagged unread for the whole viewing session and only
  // clear the next time the panel is reopened.
  useEffect(() => {
    if (!notifOpen) return undefined;
    return () => {
      const now = new Date().toISOString();
      localStorage.setItem(seenKey, now);
      setSeenAt(now);
    };
  }, [notifOpen, seenKey]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    navigate(`/admin/products?search=${encodeURIComponent(search.trim())}`);
  };

  const handleLogout = () => { logout(); navigate('/admin/login'); };

  const alerts = useMemo(() => {
    if (!summary) return [];
    const items = [];
    if (summary.pendingOrders > 0) {
      items.push({ id: 'alert-orders', Icon: ShoppingCart, className: 'bg-yellow-100 text-yellow-700', title: 'Pending orders', description: `${summary.pendingOrders} order${summary.pendingOrders === 1 ? '' : 's'} awaiting processing`, time: 'Needs attention', link: '/admin/orders' });
    }
    if (summary.pendingBookings > 0) {
      items.push({ id: 'alert-bookings', Icon: Calendar, className: 'bg-blue-100 text-blue-700', title: 'Pending bookings', description: `${summary.pendingBookings} booking${summary.pendingBookings === 1 ? '' : 's'} awaiting confirmation`, time: 'Needs attention', link: '/admin/bookings' });
    }
    if (summary.lowStockCount > 0) {
      items.push({ id: 'alert-stock', Icon: AlertTriangle, className: 'bg-red-100 text-red-700', title: 'Low stock products', description: `${summary.lowStockCount} product${summary.lowStockCount === 1 ? '' : 's'} running low`, time: 'Needs attention', link: '/admin/products' });
    }
    return items;
  }, [summary]);

  const activityItems = useMemo(() => activity.map(log => {
    const meta = ACTION_META[log.action];
    const { Icon, className } = CATEGORY_ICON[meta?.category] || { Icon: Pencil, className: 'bg-gray-100 text-gray-600' };
    return {
      id: log.id,
      Icon,
      className,
      title: meta ? `${meta.entity} ${CATEGORY_VERB[meta.category] || 'Updated'}` : 'Activity',
      description: meta && log.details ? meta.describe(log.details) : log.action,
      time: timeAgo(log.created_at),
      link: '/admin/audit-log',
      unread: !seenAt || new Date(`${log.created_at.replace(' ', 'T')}Z`).toISOString() > seenAt,
    };
  }), [activity, seenAt]);

  const notifItems = [...alerts.map(a => ({ ...a, unread: true })), ...activityItems];
  const notifCount = alerts.length + activityItems.filter(a => a.unread).length;

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-brand-navy text-white flex flex-col">
        <Link to="/" className="flex items-center gap-2 px-5 h-16 border-b border-white/10 shrink-0">
          <div className="w-8 h-8 bg-brand-orange rounded-lg flex items-center justify-center shrink-0"><Home className="w-4 h-4" /></div>
          <span className="font-display font-bold text-lg truncate">Home<span className="text-brand-orange">Link</span></span>
        </Link>
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {NAV_SECTIONS.map((section, i) => (
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
          <Link to="/admin/profile" className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition">
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
        title="Log out?"
        message="You'll need to sign in again to access the staff portal."
        confirmLabel="Log Out"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <div className="h-16 shrink-0 bg-white border-b border-gray-100 flex items-center gap-4 px-6">
          <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent outline-none transition"
            />
          </form>
          <div className="flex items-center gap-3 ml-auto">
            <div className="relative">
              <button onClick={() => setNotifOpen(o => !o)} className="relative p-2 rounded-lg hover:bg-gray-100 transition" aria-label="Notifications">
                <Bell className="w-5 h-5 text-gray-500" />
                {notifCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-orange rounded-full" />}
              </button>
              {notifOpen && (
                <>
                  <button className="fixed inset-0 z-10 cursor-default" onClick={() => setNotifOpen(false)} aria-label="Close notifications" />
                  <div className="absolute right-0 mt-2 w-96 card p-0 z-20 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">Notifications</h3>
                      {notifCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-[#00806f] text-white text-[11px] font-bold flex items-center justify-center">{notifCount}</span>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifItems.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">You're all caught up.</p>
                      ) : notifItems.map(n => (
                        <Link
                          key={n.id}
                          to={n.link}
                          onClick={() => setNotifOpen(false)}
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
                      ))}
                    </div>
                    <Link
                      to="/admin/audit-log"
                      onClick={() => setNotifOpen(false)}
                      className="block text-center text-sm font-semibold text-[#00806f] hover:text-brand-navy transition py-3 border-t border-gray-100"
                    >
                      View All Notifications
                    </Link>
                  </div>
                </>
              )}
            </div>
            <Link to="/admin/profile" className={`w-9 h-9 rounded-full ${avatarColor(user?.id)} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
              {initials(user?.firstName, user?.lastName)}
            </Link>
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
