import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoginModal } from '../context/LoginModalContext.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import { isProtectedRouteAllowed } from '../utils/roles.js';

const ProtectedRoute = ({ children, roles, allowedUserIds = [], exact = false }) => {
  const { user, loading } = useAuth();
  const { openLoginModal } = useLoginModal();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || user) return;

    openLoginModal({
      message: 'Please login to continue.',
      redirectTo: `${location.pathname}${location.search}`,
    });
    navigate('/timetable', { replace: true });
  }, [loading, user, location.pathname, location.search, openLoginModal, navigate]);

  if (loading) return <LoadingSpinner fullPage message="Checking authentication..." />;

  if (!user) return null;

  if (!isProtectedRouteAllowed({
    roles,
    exact,
    role: user.role,
    userId: user._id || user.id,
    allowedUserIds,
  })) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
