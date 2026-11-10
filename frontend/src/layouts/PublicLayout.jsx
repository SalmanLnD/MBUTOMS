import { Outlet } from 'react-router-dom';
import Topbar from '../components/Topbar.jsx';
import { useAcademicTerm } from '../context/AcademicTermContext.jsx';
import { PageTitleProvider, usePageTitleValue } from '../context/PageTitleContext.jsx';
import '../styles/layout.css';

const LayoutTopbar = () => {
  const title = usePageTitleValue();
  return <Topbar title={title} />;
};

const AcademicOutlet = () => {
  const { epoch = 0 } = useAcademicTerm() || {};
  return <Outlet key={epoch} />;
};

const PublicLayout = () => (
  <PageTitleProvider>
    <div className="app-layout app-layout--public">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <main className="main-content main-content--public" id="main-content" tabIndex={-1}>
        <div className="spatial-page spatial-layer">
          <LayoutTopbar />
          <AcademicOutlet />
        </div>
      </main>
    </div>
  </PageTitleProvider>
);

export default PublicLayout;
