import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Trainers from './pages/Trainers.jsx';
import TrainerProfile from './pages/TrainerProfile.jsx';
import Venues from './pages/Venues.jsx';
import Subjects from './pages/Subjects.jsx';
import Timetable from './pages/Timetable.jsx';
import TrainerSchedule from './pages/TrainerSchedule.jsx';
import VenueSchedule from './pages/VenueSchedule.jsx';
import ClassesStudents from './pages/ClassesStudents.jsx';
import Leaves from './pages/Leaves.jsx';
import Replacements from './pages/Replacements.jsx';
import Performance from './pages/Performance.jsx';
import PublicFeedbackForm from './pages/PublicFeedbackForm.jsx';
 
const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullPage message="Loading application..." />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route path="/f/:slug" element={<PublicFeedbackForm />} />

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
        <Route path="/timetable" element={<Timetable />} />
        <Route path="/attendance" element={<Navigate to="/trainers?tab=attendance" replace />} />
        <Route path="/classes-students" element={<ClassesStudents />} />
        <Route path="/leaves" element={<Leaves />} />
        <Route
          path="/replacements"
          element={
            <ProtectedRoute roles={['admin', 'campus_manager']}>
              <Replacements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/venue-schedule"
          element={
            <ProtectedRoute roles={['admin', 'campus_manager']}>
              <VenueSchedule />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subjects"
          element={
            <ProtectedRoute roles={['admin', 'campus_manager']}>
              <Subjects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/performance"
          element={
            <ProtectedRoute roles={['admin', 'campus_manager']}>
              <Performance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/venues"
          element={
            <ProtectedRoute roles={['admin', 'campus_manager']}>
              <Venues />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
