import { Outlet } from 'react-router-dom';
import '../styles/layout.css';

const PublicLayout = () => (
  <div className="app-layout app-layout--public">
    <main className="main-content main-content--public">
      <Outlet />
    </main>
  </div>
);

export default PublicLayout;
