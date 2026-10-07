import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Heart, User, Menu, X, Wrench, LayoutDashboard, ShieldCheck, LogOut } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { usePageTransition } from '../context/PageTransitionContext';
import ConfirmDialog from './ConfirmDialog';
import Logo from './brand/Logo';
import { landingFor } from '../utils/staffLanding';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/products', label: 'Products' },
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About' },
  { to: '/team', label: 'Team' },
  { to: '/location', label: 'Location' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { count: wishlistCount } = useWishlist();
  const coverTransitionTo = usePageTransition();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

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

  // One underline for all the links: it slides to whichever link is hovered or
  // focused and settles back under the current page's (.nav-indicator in
  // motion.css). Written straight onto the element, so hovering never re-renders.
  const linksRef = useRef(null);
  const indicatorRef = useRef(null);
  const moveIndicator = useCallback((link) => {
    const bar = indicatorRef.current;
    if (!bar) return;
    if (!link) {
      bar.style.opacity = '0';
      return;
    }
    // The first placement jumps there rather than sliding in from the left edge.
    const first = !bar.dataset.placed;
    if (first) bar.style.transition = 'none';
    bar.style.opacity = '1';
    bar.style.width = `${link.offsetWidth}px`;
    bar.style.transform = `translateX(${link.offsetLeft}px)`;
    if (first) {
      void bar.offsetWidth;
      bar.style.transition = '';
      bar.dataset.placed = '1';
    }
  }, []);
  const settleIndicator = useCallback(() => {
    moveIndicator(linksRef.current?.querySelector('[aria-current="page"]'));
  }, [moveIndicator]);

  useLayoutEffect(() => {
    settleIndicator();
    // The webfont swapping in changes how wide each link is.
    document.fonts?.ready.then(settleIndicator);
    window.addEventListener('resize', settleIndicator);
    return () => window.removeEventListener('resize', settleIndicator);
  }, [location.pathname, settleIndicator]);

  // How far down the page the reader is, as a thin line along the top edge.
  const progressRef = useRef(null);
  useEffect(() => {
    const bar = progressRef.current;
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [location.pathname]);

  const requestLogout = () => { setOpen(false); setConfirmLogout(true); };
  // Full reload (not client-side navigate) so any logged-in-only state cached
  // in memory across the app — cart, account data, etc. — is cleared for good.
  // The delivery transition (App.jsx) hides the page before logging out and
  // reloading, and the reloaded homepage opens under the same smoke.
  const handleLogout = () => {
    setConfirmLogout(false);
    coverTransitionTo('/', { reload: true, before: logout });
  };

  // The delivery transition lives in App.jsx (it has to survive Navbar
  // unmounting once we land on /login), so this just hands off to it.
  const handleLoginClick = (e) => {
    e.preventDefault();
    setOpen(false);
    coverTransitionTo('/login');
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
      <span
        ref={progressRef}
        aria-hidden="true"
        className="nav-progress absolute top-0 left-0 w-full h-[2px] origin-left bg-gradient-to-r from-brand-orange to-amber-400"
        style={{ transform: 'scaleX(0)' }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="group">
            <Logo tone={solidWhite ? 'navy' : 'white'} markClassName="w-11" />
          </Link>

          <div ref={linksRef} onMouseLeave={settleIndicator} className="relative hidden md:flex items-stretch gap-8 h-full">
            {NAV_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={isActive(link.to) ? 'page' : undefined}
                onMouseEnter={e => moveIndicator(e.currentTarget)}
                onFocus={e => moveIndicator(e.currentTarget)}
                onBlur={settleIndicator}
                className={`relative flex items-center text-sm font-medium tracking-wide transition ${
                  isActive(link.to)
                    ? solidWhite ? 'text-brand-navy' : 'text-white'
                    : solidWhite ? 'text-gray-500 hover:text-brand-navy' : 'text-white/70 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <span
              ref={indicatorRef}
              aria-hidden="true"
              className="nav-indicator absolute bottom-0 left-0 h-0.5 rounded-full bg-brand-orange pointer-events-none"
              style={{ opacity: 0, width: 0 }}
            />
          </div>

          <div className="flex items-center gap-3">
            {user?.role === 'customer' && (
              <Link to="/wishlist" className={`relative p-2 rounded-lg transition ${solidWhite ? 'text-gray-600 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`}>
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && <span className="absolute -top-1 -right-1 bg-brand-orange text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold text-white">{wishlistCount}</span>}
              </Link>
            )}
            {user?.role === 'customer' && (
              <Link to="/cart" data-cart-target className={`relative p-2 rounded-lg transition ${solidWhite ? 'text-gray-600 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`}>
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
        className={`md:hidden bg-gradient-to-b from-brand-navy/95 to-brand-navy/90 backdrop-blur-xl text-white overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${open ? 'max-h-[480px] opacity-100 border-t border-white/10' : 'max-h-0 opacity-0'}`}
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
    </nav>
  );
}
