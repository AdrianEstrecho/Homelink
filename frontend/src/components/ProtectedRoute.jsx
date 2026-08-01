import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles, positions, redirectTo = '/login' }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to={redirectTo} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  // Positions further scope an already-allowed role (e.g. only certain employee
  // positions can reach a given admin page) — admins are never restricted by it.
  if (positions && user.role !== 'admin' && !positions.includes(user.position)) return <Navigate to="/" replace />;
  return children;
}
