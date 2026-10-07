import { useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import PageTransitionOverlay, { arriveAfterReload } from './components/PageTransitionOverlay';
import AssistantWidget from './components/assistant/AssistantWidget';
import { PageTransitionProvider } from './context/PageTransitionContext';
import NotFound from './pages/NotFound';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import ServiceBook from './pages/ServiceBook';
import BookingReturn from './pages/BookingReturn';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Checkout from './pages/Checkout';
import CheckoutReturn from './pages/CheckoutReturn';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import VerifyResetCode from './pages/VerifyResetCode';
import ResetPassword from './pages/ResetPassword';
import Terms from './pages/Terms';
import Account from './pages/Account';
import Orders from './pages/Orders';
import Bookings from './pages/Bookings';
import Policies from './pages/Policies';
import Location from './pages/Location';
import About from './pages/About';
import Team from './pages/Team';
import FAQ from './pages/FAQ';
import AdminLogin from './pages/admin/AdminLogin';
import StaffForgotPassword from './pages/admin/StaffForgotPassword';
import AdminDashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/Products';
import AdminServices from './pages/admin/Services';
import AdminOrders from './pages/admin/Orders';
import AdminReturns from './pages/admin/Returns';
import AdminBookings from './pages/admin/Bookings';
import InventoryDashboard from './pages/admin/InventoryDashboard';
import Approvals from './pages/admin/Approvals';
import OrdersDashboard from './pages/admin/OrdersDashboard';
import BookingsDashboard from './pages/admin/BookingsDashboard';
import AdminUsers from './pages/admin/Users';
import AdminManagement from './pages/admin/AdminManagement';
import AdminVouchers from './pages/admin/Vouchers';
import AdminSupportMessages from './pages/admin/SupportMessages';
import AdminAuditLog from './pages/admin/AuditLog';
import AdminProfile from './pages/admin/Profile';
import AdminReports from './pages/admin/Reports';
import AdminCMS from './pages/admin/CMS';
import AdminSettings from './pages/admin/Settings';
import HRDashboard from './pages/admin/HRDashboard';
import EmployeeManagement from './pages/admin/EmployeeManagement';
import Suppliers from './pages/admin/Suppliers';
import Technicians from './pages/admin/Technicians';
import Messages from './pages/admin/Messages';
import EmployeeProfile from './pages/employee/Profile';
import EmployeeDashboard from './pages/employee/Dashboard';
import JobStatus from './pages/employee/JobStatus';

const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/verify-reset-code', '/reset-password'];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  // Employee pages use the same AdminLayout shell (sidebar/topbar) as /admin/* —
  // both need the public Navbar/Footer hidden so the two shells don't stack.
  const isStaffSection = location.pathname.startsWith('/admin') || location.pathname.startsWith('/employee');
  const isAuthSection = AUTH_PATHS.includes(location.pathname);
  const hideChrome = isStaffSection || isAuthSection;

  // The delivery transition (PageTransitionOverlay) for moments that warrant
  // more ceremony than the default route-fade: entering the login flow, landing
  // back on a page after a successful login/signup, and logging out. Exposed via
  // PageTransitionContext so any page can trigger it. Navbar/Login/Register/
  // Account all unmount across these navigations, so the overlay has to live up
  // here to bridge the two pages. navigate() fires once the smoke has hidden the
  // page. With `reload`, the page is reloaded there instead, after `before`
  // (e.g. logout) has run, and the reloaded page clears the same smoke.
  const [cover, setCover] = useState(null); // { path, reload, before } while it runs
  const covering = useRef(false);
  const coverTransitionTo = useCallback((path, { reload = false, before } = {}) => {
    if (covering.current) return;
    covering.current = true;
    setCover({ path, reload, before });
  }, []);
  const handleCovered = () => {
    cover.before?.();
    if (!cover.reload) {
      navigate(cover.path);
      return;
    }
    arriveAfterReload();
    window.location.href = cover.path;
  };
  const endCover = useCallback(() => {
    covering.current = false;
    setCover(null);
  }, []);
  // Set by index.html when this load is the reload at the end of a logout.
  const [arriving, setArriving] = useState(() => document.documentElement.classList.contains('arriving'));

  // Browsers don't reset scroll position on client-side route changes, so a nav
  // click from partway down one page lands partway down the next. Keyed on
  // pathname only (not search/hash) so in-page filter changes don't reset scroll.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== '/login') return;
    const handleStaffShortcut = (e) => {
      if (e.ctrlKey && e.altKey && e.code === 'Period') {
        e.preventDefault();
        navigate('/admin/login');
      }
    };
    window.addEventListener('keydown', handleStaffShortcut);
    return () => window.removeEventListener('keydown', handleStaffShortcut);
  }, [location.pathname, navigate]);

  return (
    <PageTransitionProvider value={coverTransitionTo}>
    <div className="min-h-screen flex flex-col">
      {!hideChrome && (
        <div className="ambient-mesh" aria-hidden="true">
          <span className="float-blob w-[32rem] h-[32rem] -top-40 -right-32 bg-brand-orange" />
          <span className="float-blob-delayed w-[28rem] h-[28rem] top-[40vh] -left-40 bg-brand-teal" />
          <span className="float-blob w-[30rem] h-[30rem] bottom-[-10rem] right-[10vw] bg-brand-blue" />
        </div>
      )}
      {!hideChrome && <Navbar />}
      {cover && <PageTransitionOverlay stayCovered={cover.reload} onCovered={handleCovered} onDone={endCover} />}
      {arriving && <PageTransitionOverlay mode="arrive" onDone={() => setArriving(false)} />}
      <main className={hideChrome ? '' : 'flex-1'}>
        {/* key={location.pathname} forces a fresh DOM node per route, so route-fade's
            CSS animation (not a transition) reliably replays on every navigation — a
            transition here would need two distinct painted frames to animate between
            and is prone to being collapsed into an instant jump; an animation on a
            freshly-mounted node always plays from its 0% keyframe. Opacity-only (no
            transform) so it never creates a containing block for a page's fixed-position
            content (modals, toasts). Skipped for the admin/employee section — staff
            navigate between pages far more often and the fade only added lag there. */}
        <div key={location.pathname} className={isStaffSection ? '' : 'route-fade'}>
        <ErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:slug" element={<ServiceDetail />} />
          <Route path="/services/:slug/book" element={<ProtectedRoute roles={['customer']}><ServiceBook /></ProtectedRoute>} />
          <Route path="/bookings/return" element={<ProtectedRoute roles={['customer']}><BookingReturn /></ProtectedRoute>} />
          <Route path="/cart" element={<ProtectedRoute roles={['customer']}><Cart /></ProtectedRoute>} />
          <Route path="/wishlist" element={<ProtectedRoute roles={['customer']}><Wishlist /></ProtectedRoute>} />
          <Route path="/checkout" element={<ProtectedRoute roles={['customer']}><Checkout /></ProtectedRoute>} />
          <Route path="/checkout/return" element={<ProtectedRoute roles={['customer']}><CheckoutReturn /></ProtectedRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-reset-code" element={<VerifyResetCode />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/account" element={<ProtectedRoute roles={['customer', 'employee', 'admin']}><Account /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute roles={['customer']}><Orders /></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute roles={['customer']}><Bookings /></ProtectedRoute>} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/location" element={<Location />} />
          <Route path="/about" element={<About />} />
          <Route path="/team" element={<Team />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/forgot-password" element={<StaffForgotPassword />} />
          <Route path="/admin" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/products/dashboard" element={<ProtectedRoute roles={['admin', 'employee']} positions={['inventory_clerk']} redirectTo="/admin/login"><InventoryDashboard /></ProtectedRoute>} />
          <Route path="/admin/approvals" element={<ProtectedRoute roles={['admin', 'employee']} positions={['inventory_clerk', 'booking_coordinator', 'hr']} redirectTo="/admin/login"><Approvals /></ProtectedRoute>} />
          <Route path="/admin/products" element={<ProtectedRoute roles={['admin', 'employee']} positions={['inventory_clerk', 'general_staff']} redirectTo="/admin/login"><AdminProducts /></ProtectedRoute>} />
          <Route path="/admin/services" element={<ProtectedRoute roles={['admin', 'employee']} positions={['inventory_clerk', 'general_staff']} redirectTo="/admin/login"><AdminServices /></ProtectedRoute>} />
          <Route path="/admin/orders/dashboard" element={<ProtectedRoute roles={['admin', 'employee']} positions={['general_staff']} redirectTo="/admin/login"><OrdersDashboard /></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute roles={['admin', 'employee']} positions={['general_staff', 'inventory_clerk']} redirectTo="/admin/login"><AdminOrders /></ProtectedRoute>} />
          <Route path="/admin/returns" element={<ProtectedRoute roles={['admin', 'employee']} positions={['inventory_clerk']} redirectTo="/admin/login"><AdminReturns /></ProtectedRoute>} />
          <Route path="/admin/bookings/dashboard" element={<ProtectedRoute roles={['admin', 'employee']} positions={['booking_coordinator']} redirectTo="/admin/login"><BookingsDashboard /></ProtectedRoute>} />
          <Route path="/admin/bookings" element={<ProtectedRoute roles={['admin', 'employee']} positions={['booking_coordinator', 'general_staff', 'inventory_clerk']} redirectTo="/admin/login"><AdminBookings /></ProtectedRoute>} />
          <Route path="/admin/technicians" element={<ProtectedRoute roles={['admin', 'employee']} positions={['booking_coordinator']} redirectTo="/admin/login"><Technicians /></ProtectedRoute>} />
          <Route path="/admin/messages" element={<ProtectedRoute roles={['admin', 'employee']} redirectTo="/admin/login"><Messages /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/staff" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><AdminManagement /></ProtectedRoute>} />
          <Route path="/admin/vouchers" element={<ProtectedRoute roles={['admin', 'employee']} positions={['general_staff', 'inventory_clerk']} redirectTo="/admin/login"><AdminVouchers /></ProtectedRoute>} />
          <Route path="/admin/support" element={<ProtectedRoute roles={['admin', 'employee']} positions={['general_staff', 'inventory_clerk']} redirectTo="/admin/login"><AdminSupportMessages /></ProtectedRoute>} />
          <Route path="/admin/audit-log" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><AdminAuditLog /></ProtectedRoute>} />
          <Route path="/admin/profile" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><AdminProfile /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute roles={['admin', 'employee']} positions={['hr']} redirectTo="/admin/login"><AdminReports /></ProtectedRoute>} />
          <Route path="/admin/cms" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><AdminCMS /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><AdminSettings /></ProtectedRoute>} />
          <Route path="/admin/hr/dashboard" element={<ProtectedRoute roles={['admin', 'employee']} positions={['hr']} redirectTo="/admin/login"><HRDashboard /></ProtectedRoute>} />
          <Route path="/admin/hr/employees" element={<ProtectedRoute roles={['admin', 'employee']} positions={['hr']} redirectTo="/admin/login"><EmployeeManagement /></ProtectedRoute>} />
          <Route path="/admin/suppliers" element={<ProtectedRoute roles={['admin', 'employee']} positions={['hr']} redirectTo="/admin/login"><Suppliers /></ProtectedRoute>} />
          <Route path="/employee" element={<ProtectedRoute roles={['employee']} redirectTo="/admin/login"><EmployeeDashboard /></ProtectedRoute>} />
          <Route path="/employee/job-status" element={<ProtectedRoute roles={['admin', 'employee']} positions={['installer']} redirectTo="/admin/login"><JobStatus /></ProtectedRoute>} />
          <Route path="/employee/profile" element={<ProtectedRoute roles={['employee']} redirectTo="/admin/login"><EmployeeProfile /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </ErrorBoundary>
        </div>
      </main>
      {!hideChrome && <Footer />}
      {/* Mounted on the auth pages too (just hidden), so a guest the assistant sends off to log in
          comes back to the same conversation. */}
      {!isStaffSection && <AssistantWidget hidden={isAuthSection} />}
    </div>
    </PageTransitionProvider>
  );
}
