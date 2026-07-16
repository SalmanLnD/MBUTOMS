import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { useLoginModal } from './context/LoginModalContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import LoginModal from './components/LoginModal.jsx';
import SessionExpiredModal from './components/SessionExpiredModal.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import OptionalAuthLayout from './layouts/OptionalAuthLayout.jsx';
import { needsPasswordReset, MANAGEMENT_ROLES } from './utils/roles.js';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Trainers = lazy(() => import('./pages/Trainers.jsx'));
const TrainerProfile = lazy(() => import('./pages/TrainerProfile.jsx'));
const Venues = lazy(() => import('./pages/Venues.jsx'));
const Subjects = lazy(() => import('./pages/Subjects.jsx'));
const Timetable = lazy(() => import('./pages/Timetable.jsx'));
const TrainerSchedule = lazy(() => import('./pages/TrainerSchedule.jsx'));
const ClassesStudents = lazy(() => import('./pages/ClassesStudents.jsx'));
const Leaves = lazy(() => import('./pages/Leaves.jsx'));
const Tickets = lazy(() => import('./pages/Tickets.jsx'));
const TopicTracker = lazy(() => import('./pages/TopicTracker.jsx'));
const Replacements = lazy(() => import('./pages/Replacements.jsx'));
const Performance = lazy(() => import('./pages/Performance.jsx'));
const PublicFeedbackForm = lazy(() => import('./pages/PublicFeedbackForm.jsx'));

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
    <Suspense fallback={<LoadingSpinner fullPage message="Loading page..." />}>
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
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/topic-tracker" element={<TopicTracker />} />
        <Route
          path="/replacements"
          element={
            <ProtectedRoute roles={MANAGEMENT_ROLES}>
              <Replacements />
            </ProtectedRoute>
          }
        />
        <Route path="/subjects" element={<Subjects />} />
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
    </Suspense>
    <LoginModal />
    <SessionExpiredModal />
  </>
);

export default App;
