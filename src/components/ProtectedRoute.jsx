import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Guards routes that require authentication (and optionally a set of roles).
export default function ProtectedRoute({ children, role, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const allowed = roles || (role ? [role] : null);

  if (loading) {
    return <div className="d-flex justify-content-center py-5"><div className="spinner-border text-primary" role="status" /></div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (allowed && !allowed.includes(user.role)) {
    const fallback = user.role === 'Admin' ? '/admin' : user.role === 'Authority' ? '/author' : user.role === 'Lawyer' ? '/lawyer' : '/feed';
    return <Navigate to={fallback} replace />;
  }
  return children;
}
