import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Heart, User, Menu, X, Home, Wrench, LayoutDashboard, ShieldCheck, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import ConfirmDialog from './ConfirmDialog';
import PageTransitionOverlay from './PageTransitionOverlay';
import { landingFor } from '../utils/staffLanding';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/products', label: 'Products' },
  { to: '/services', label: 'Services' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/policies', label: 'Policies' },
  { to: '/location', label: 'Location' },
];

export default function Navbar({ onLoginClick }) {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { count: wishlistCount } = useWishlist();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Only the homepage has a dark hero directly beneath the nav, so the
  // transparent-until-scrolled treatment is scoped to it — every other page
  // is plain-background content and stays on the solid navy bar below.
  const isHome = location.pathname === '/';
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const heroWrap = document.querySelector('.hero-wrap');
    if (!heroWrap) { setPastHero(true); return; }
    let ticking = false;
    const update = () => {
      ticking = false;
      setPastHero(heroWrap.getBoundingClientRect().bottom <= 80);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [isHome]);

  const transparent = isHome && !pastHero;
  const solidWhite = isHome && pastHero;

  const requestLogout = () => { setOpen(false); setConfirmLogout(true); };
  // Full reload (not client-side navigate) so any logged-in-only state cached
  // in memory across the app — cart, account data, etc. — is cleared for good.
  // The branded overlay covers that reload's blank-white flash; its hold time
  // just needs to clear the .3s cover-in animation before the page unloads.
  const handleLogout = () => {
    setConfirmLogout(false);
    setLoggingOut(true);
    setTimeout(() => { logout(); window.location.href = '/'; }, 600);
  };

  // The full-screen cover transition lives in App.jsx (it has to survive Navbar
  // unmounting once we land on /login), so this just hands off to it.
  const handleLoginClick = (e) => {
    e.preventDefault();
    setOpen(false);
    onLoginClick('/login');
  };

  // Employees have no separate "Employee" nav item — their one entry point is the
  // Admin Panel shortcut below, which already lands them on the right page for their
  // position (or /employee for installer/unscoped positions).
  const dashLink = user?.role === 'admin' ? '/admin' : user?.role === 'customer' ? '/account' : null;
  const adminShortcut = user?.role === 'employee' ? landingFor(user) : null;
  const isActive = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <nav
      className={`sticky top-0 z-50 transition-[background-color,box-shadow,border-color,backdrop-filter] duration-300 ${
        transparent
          ? 'bg-transparent border-b border-transparent'
          : solidWhite
          ? 'bg-gradient-to-b from-white/85 to-white/60 backdrop-blur-xl border-b border-white/40 shadow-sm'
          : 'bg-gradient-to-b from-brand-navy/95 to-brand-navy/80 backdrop-blur-xl border-b border-white/10'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-brand-orange rounded-lg flex items-center justify-center group-hover:scale-105 transition">
              <Home className="w-5 h-5 text-white" />
            </div>
            <span className={`font-display font-extrabold text-xl tracking-tight transition-colors ${solidWhite ? 'text-brand-navy' : 'text-white'}`}>Home<span className="text-brand-orange">Link</span></span>
          </Link>

          <div className="hidden md:flex items-stretch gap-8 h-full">
            {NAV_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={isActive(link.to) ? 'page' : undefined}
                className={`relative flex items-center text-sm font-medium tracking-wide transition ${
                  isActive(link.to)
                    ? solidWhite ? 'text-brand-navy' : 'text-white'
                    : solidWhite ? 'text-gray-500 hover:text-brand-navy' : 'text-white/70 hover:text-white'
                }`}
              >
                {link.label}
                {isActive(link.to) && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-orange" />}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {user?.role === 'customer' && (
              <Link to="/wishlist" className={`relative p-2 rounded-lg transition ${solidWhite ? 'text-gray-600 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`}>
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && <span className="absolute -top-1 -right-1 bg-brand-orange text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold text-white">{wishlistCount}</span>}
              </Link>
            )}
            {user?.role === 'customer' && (
              <Link to="/cart" className={`relative p-2 rounded-lg transition ${solidWhite ? 'text-gray-600 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`}>
                <ShoppingCart className="w-5 h-5" />
                {count > 0 && <span className="absolute -top-1 -right-1 bg-brand-orange text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold text-white">{count}</span>}
              </Link>
            )}
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                {dashLink && (
                  <Link to={dashLink} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition text-sm ${solidWhite ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`}>
                    <LayoutDashboard className="w-4 h-4" />
                    {user.role === 'admin' ? 'Admin' : 'Account'}
                  </Link>
                )}
                {adminShortcut && (
                  <Link to={adminShortcut} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-orange/90 hover:bg-brand-orange text-white rounded-lg transition text-sm font-medium">
                    <ShieldCheck className="w-4 h-4" /> Admin Panel
                  </Link>
                )}
                <button onClick={requestLogout} className={`p-2 rounded-lg transition ${solidWhite ? 'text-gray-600 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`} title="Logout"><LogOut className="w-4 h-4" /></button>
              </div>
            ) : (
              <Link to="/login" onClick={handleLoginClick} className="hidden md:flex items-center gap-1.5 btn-primary text-sm py-2 px-4">
                <User className="w-4 h-4" /> Login
              </Link>
            )}
            <button className={`md:hidden p-2 rounded-lg transition ${solidWhite ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`md:hidden bg-gradient-to-b from-brand-navy/95 to-brand-navy/90 backdrop-blur-xl text-white overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${open ? 'max-h-[420px] opacity-100 border-t border-white/10' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-4 py-4 space-y-1">
          {NAV_LINKS.map(link => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={isActive(link.to) ? 'page' : undefined}
              className={`block px-2 py-2 rounded-lg transition ${isActive(link.to) ? 'bg-white/10 text-brand-orange' : 'hover:bg-white/5'}`}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <>
              {user.role === 'customer' && (
                <Link to="/wishlist" className="flex items-center gap-1.5 px-2 py-2 rounded-lg hover:bg-white/5" onClick={() => setOpen(false)}>
                  <Heart className="w-4 h-4" /> Wishlist{wishlistCount > 0 ? ` (${wishlistCount})` : ''}
                </Link>
              )}
              {dashLink && (
                <Link to={dashLink} className="block px-2 py-2 rounded-lg hover:bg-white/5" onClick={() => setOpen(false)}>Dashboard</Link>
              )}
              {adminShortcut && (
                <Link to={adminShortcut} className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-brand-orange font-medium hover:bg-white/5" onClick={() => setOpen(false)}>
                  <ShieldCheck className="w-4 h-4" /> Admin Panel
                </Link>
              )}
              <button onClick={requestLogout} className="block w-full text-left px-2 py-2 rounded-lg text-brand-orange hover:bg-white/5">Logout</button>
            </>
          ) : (
            <Link to="/login" onClick={handleLoginClick} className="block px-2 py-2 rounded-lg text-brand-orange font-semibold hover:bg-white/5">
              Login / Register
            </Link>
          )}
        </div>
      </div>

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
    </nav>
  );
}
