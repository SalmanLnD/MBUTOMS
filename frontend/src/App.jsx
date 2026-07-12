import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { useLoginModal } from './context/LoginModalContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import LoginModal from './components/LoginModal.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import OptionalAuthLayout from './layouts/OptionalAuthLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Trainers from './pages/Trainers.jsx';
import TrainerProfile from './pages/TrainerProfile.jsx';
import Venues from './pages/Venues.jsx';
import Subjects from './pages/Subjects.jsx';
import Timetable from './pages/Timetable.jsx';
import TrainerSchedule from './pages/TrainerSchedule.jsx';
import ClassesStudents from './pages/ClassesStudents.jsx';
import Leaves from './pages/Leaves.jsx';
import Replacements from './pages/Replacements.jsx';
import Performance from './pages/Performance.jsx';
import PublicFeedbackForm from './pages/PublicFeedbackForm.jsx';
import { needsPasswordReset, MANAGEMENT_ROLES } from './utils/roles.js';

const LoginRedirect = () => {
  const { user, loading } = useAuth();
  const { openLoginModal } = useLoginModal();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (user && !needsPasswordReset(user)) {
      navigate('/dashboard', { replace: true });
      return;
    }

    openLoginModal();
    navigate('/timetable', { replace: true });
  }, [loading, user, openLoginModal, navigate]);

  return <LoadingSpinner fullPage message="Redirecting..." />;
};

const HomeRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullPage message="Loading application..." />;
  }

  return <Navigate to={user ? '/dashboard' : '/timetable'} replace />;
};

const App = () => (
  <>
    <Routes>
      <Route path="/login" element={<LoginRedirect />} />
      <Route path="/f/:slug" element={<PublicFeedbackForm />} />

      <Route element={<OptionalAuthLayout />}>
        <Route path="/timetable" element={<Timetable />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/trainers" element={<Trainers />} />
        <Route path="/trainers/:id" element={<TrainerProfile />} />
        <Route path="/trainers/:id/schedule" element={<TrainerSchedule />} />
        <Route path="/attendance" element={<Navigate to="/trainers?tab=attendance" replace />} />
        <Route path="/classes-students" element={<ClassesStudents />} />
        <Route path="/leaves" element={<Leaves />} />
        <Route
          path="/replacements"
          element={
            <ProtectedRoute roles={MANAGEMENT_ROLES}>
              <Replacements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subjects"
          element={
            <ProtectedRoute roles={MANAGEMENT_ROLES}>
              <Subjects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/performance"
          element={
            <ProtectedRoute roles={MANAGEMENT_ROLES}>
              <Performance />
            </ProtectedRoute>
          }
        />
        <Route path="/venues" element={<Venues />} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
    <LoginModal />
  </>
);

export default App;
