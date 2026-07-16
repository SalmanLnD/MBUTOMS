import { Outlet } from 'react-router-dom';
import Topbar from '../components/Topbar.jsx';
import { PageTitleProvider, usePageTitleValue } from '../context/PageTitleContext.jsx';
import '../styles/layout.css';

const LayoutTopbar = () => {
  const title = usePageTitleValue();
  return <Topbar title={title} />;
};

const PublicLayout = () => (
  <PageTitleProvider>
    <div className="app-layout app-layout--public">
      <main className="main-content main-content--public">
        <LayoutTopbar />
        <Outlet />
      </main>
    </div>
  </PageTitleProvider>
);

export default PublicLayout;
