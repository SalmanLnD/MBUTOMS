import { memo, useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import MobileBubbleNav from '../components/MobileBubbleNav.jsx';
import ResetPasswordModal from '../components/ResetPasswordModal.jsx';
import Topbar from '../components/Topbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { PageTitleProvider, usePageTitleValue } from '../context/PageTitleContext.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
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
  // Tablet band (768–991.98px): force the icon rail so content keeps its width.
  // The stored preference is not overwritten and applies again on desktop.
  const isTablet = useMediaQuery('(max-width: 991.98px)');
  const effectiveCollapsed = isTablet || sidebarCollapsed;

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
    <div className={`app-layout ${effectiveCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        collapsed={effectiveCollapsed}
        labelsVisible={!effectiveCollapsed}
        onToggle={isTablet ? undefined : toggleSidebar}
      />
      <MainContent>{children}</MainContent>
      <MobileBubbleNav />
    </div>
  );
};

const LayoutTopbar = () => {
  const title = usePageTitleValue();
  return <Topbar title={title} />;
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
    <PageTitleProvider>
      <AppShell>
        <LayoutTopbar />
        <Outlet />
        {needsReset && (
          <ResetPasswordModal show onComplete={handlePasswordResetComplete} />
        )}
      </AppShell>
    </PageTitleProvider>
  );
};

export default MainLayout;
