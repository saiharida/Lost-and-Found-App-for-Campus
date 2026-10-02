import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  // If auth state is actively checking, wait before deciding to redirect
  if (authLoading) {
    return null; // Or a subtle shell spinner if desired
  }

  // If there's no user in state AND none in localStorage, redirect to login
  const hasStoredUser = !!localStorage.getItem('lf_user');
  if (!user && !hasStoredUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}