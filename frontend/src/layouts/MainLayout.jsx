import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import { resetAllModalArtifacts } from '../utils/modalCleanup.js';
import '../styles/layout.css';

const MainLayout = () => {
  const location = useLocation();

  useEffect(() => {
    resetAllModalArtifacts();
  }, [location.pathname]);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
