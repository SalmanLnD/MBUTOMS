import { memo, useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import MobileBubbleNav from '../components/MobileBubbleNav.jsx';
import ResetPasswordModal from '../components/ResetPasswordModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { resetAllModalArtifacts } from '../utils/modalCleanup.js';
import '../styles/layout.css';

const SIDEBAR_COLLAPSED_KEY = 'toms_sidebar_collapsed';

const readCollapsedPreference = () => {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
};

const MainContent = memo(function MainContent({ children }) {
  return <main className="main-content">{children}</main>;
});

const AppShell = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readCollapsedPreference);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((current) => !current);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    } catch {
      // ignore storage errors
    }
  }, [sidebarCollapsed]);

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        labelsVisible={!sidebarCollapsed}
        onToggle={toggleSidebar}
      />
      <MainContent>{children}</MainContent>
      <MobileBubbleNav />
    </div>
  );
};

const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, completePasswordReset } = useAuth();
  const needsReset = Boolean(user?.mustResetPassword || user?.requiresPasswordReset);

  useEffect(() => {
    resetAllModalArtifacts();
  }, [location.pathname]);

  const handlePasswordResetComplete = (data) => {
    completePasswordReset(data);
    navigate('/dashboard');
  };

  return (
    <AppShell>
      <Outlet />
      {needsReset && (
        <ResetPasswordModal show onComplete={handlePasswordResetComplete} />
      )}
    </AppShell>
  );
};

export default MainLayout;
