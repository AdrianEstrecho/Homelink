import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './pages/NotFound';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Services from './pages/Services';
import ServiceBook from './pages/ServiceBook';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
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
import Gallery from './pages/Gallery';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/Products';
import AdminServices from './pages/admin/Services';
import AdminOrders from './pages/admin/Orders';
import AdminBookings from './pages/admin/Bookings';
import AdminUsers from './pages/admin/Users';
import AdminManagement from './pages/admin/AdminManagement';
import ArchivedUsers from './pages/admin/ArchivedUsers';
import AdminVouchers from './pages/admin/Vouchers';
import AdminSupportMessages from './pages/admin/SupportMessages';
import AdminAuditLog from './pages/admin/AuditLog';
import AdminProfile from './pages/admin/Profile';
import EmployeeProfile from './pages/employee/Profile';
import EmployeeDashboard from './pages/employee/Dashboard';

const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/verify-reset-code', '/reset-password'];

export default function App() {
  const location = useLocation();
  const isAdminSection = location.pathname.startsWith('/admin');
  const isAuthSection = AUTH_PATHS.includes(location.pathname);
  const hideChrome = isAdminSection || isAuthSection;

  return (
    <div className="min-h-screen flex flex-col">
      {!hideChrome && <Navbar />}
      <main className={hideChrome ? '' : 'flex-1'}>
        <ErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:slug/book" element={<ProtectedRoute roles={['customer']}><ServiceBook /></ProtectedRoute>} />
          <Route path="/cart" element={<ProtectedRoute roles={['customer']}><Cart /></ProtectedRoute>} />
          <Route path="/checkout" element={<ProtectedRoute roles={['customer']}><Checkout /></ProtectedRoute>} />
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
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/products" element={<ProtectedRoute roles={['admin', 'employee']} positions={['inventory_clerk']} redirectTo="/admin/login"><AdminProducts /></ProtectedRoute>} />
          <Route path="/admin/services" element={<ProtectedRoute roles={['admin', 'employee']} positions={['inventory_clerk']} redirectTo="/admin/login"><AdminServices /></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute roles={['admin', 'employee']} positions={['general_staff']} redirectTo="/admin/login"><AdminOrders /></ProtectedRoute>} />
          <Route path="/admin/bookings" element={<ProtectedRoute roles={['admin', 'employee']} positions={['booking_coordinator']} redirectTo="/admin/login"><AdminBookings /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/archived-users" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><ArchivedUsers /></ProtectedRoute>} />
          <Route path="/admin/staff" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><AdminManagement /></ProtectedRoute>} />
          <Route path="/admin/vouchers" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><AdminVouchers /></ProtectedRoute>} />
          <Route path="/admin/support" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><AdminSupportMessages /></ProtectedRoute>} />
          <Route path="/admin/audit-log" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><AdminAuditLog /></ProtectedRoute>} />
          <Route path="/admin/profile" element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login"><AdminProfile /></ProtectedRoute>} />
          <Route path="/employee" element={<ProtectedRoute roles={['employee']} redirectTo="/admin/login"><EmployeeDashboard /></ProtectedRoute>} />
          <Route path="/employee/profile" element={<ProtectedRoute roles={['employee']} redirectTo="/admin/login"><EmployeeProfile /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </ErrorBoundary>
      </main>
      {!hideChrome && <Footer />}
    </div>
  );
}
