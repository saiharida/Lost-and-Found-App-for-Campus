import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading session...</div>;
  }

  // If not logged in or not an admin, redirect to regular login
  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return children;
}