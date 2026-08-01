import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Menu, X, Home, Wrench, LayoutDashboard, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import ConfirmDialog from './ConfirmDialog';

const NAV_LINKS = [
  { to: '/products', label: 'Products' },
  { to: '/services', label: 'Services' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/policies', label: 'Policies' },
  { to: '/location', label: 'Location' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const requestLogout = () => { setOpen(false); setConfirmLogout(true); };
  const handleLogout = () => { setConfirmLogout(false); logout(); navigate('/'); };

  const dashLink = user?.role === 'admin' ? '/admin' : user?.role === 'employee' ? '/employee' : '/account';
  const isActive = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <nav className="bg-brand-navy text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-brand-orange rounded-lg flex items-center justify-center group-hover:scale-105 transition">
              <Home className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Home<span className="text-brand-orange">Link</span></span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={isActive(link.to) ? 'page' : undefined}
                className={`relative py-1 font-medium transition ${isActive(link.to) ? 'text-brand-orange' : 'hover:text-brand-orange'}`}
              >
                {link.label}
                {isActive(link.to) && <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-brand-orange" />}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {user?.role === 'customer' && (
              <Link to="/cart" className="relative p-2 hover:bg-white/10 rounded-lg transition">
                <ShoppingCart className="w-5 h-5" />
                {count > 0 && <span className="absolute -top-1 -right-1 bg-brand-orange text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{count}</span>}
              </Link>
            )}
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <Link to={dashLink} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/10 rounded-lg transition text-sm">
                  <LayoutDashboard className="w-4 h-4" />
                  {user.role === 'admin' ? 'Admin' : user.role === 'employee' ? 'Employee' : 'Account'}
                </Link>
                <button onClick={requestLogout} className="p-2 hover:bg-white/10 rounded-lg transition" title="Logout"><LogOut className="w-4 h-4" /></button>
              </div>
            ) : (
              <Link to="/login" className="hidden md:flex items-center gap-1.5 btn-primary text-sm py-2 px-4">
                <User className="w-4 h-4" /> Login
              </Link>
            )}
            <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`md:hidden bg-brand-blue overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${open ? 'max-h-[420px] opacity-100 border-t border-white/10' : 'max-h-0 opacity-0'}`}
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
              <Link to={dashLink} className="block px-2 py-2 rounded-lg hover:bg-white/5" onClick={() => setOpen(false)}>Dashboard</Link>
              <button onClick={requestLogout} className="block w-full text-left px-2 py-2 rounded-lg text-brand-orange hover:bg-white/5">Logout</button>
            </>
          ) : (
            <Link to="/login" className="block px-2 py-2 rounded-lg text-brand-orange font-semibold hover:bg-white/5" onClick={() => setOpen(false)}>Login / Register</Link>
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
