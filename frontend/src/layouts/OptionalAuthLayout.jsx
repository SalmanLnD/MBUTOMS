import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import MainLayout from './MainLayout.jsx';
import PublicLayout from './PublicLayout.jsx';

const PUBLIC_ONLY_PATH = '/timetable';

const OptionalAuthLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner fullPage message="Loading application..." />;
  }

  if (!user && location.pathname !== PUBLIC_ONLY_PATH) {
    return <Navigate to={PUBLIC_ONLY_PATH} replace />;
  }

  if (user) {
    return <MainLayout />;
  }

  return <PublicLayout />;
};

export default OptionalAuthLayout;
