import { memo, useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
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
    </div>
  );
};

const MainLayout = () => {
  const location = useLocation();

  useEffect(() => {
    resetAllModalArtifacts();
  }, [location.pathname]);

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

export default MainLayout;
