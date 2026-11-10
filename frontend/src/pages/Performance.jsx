import AsyncButton from '../components/AsyncButton.jsx';
import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { FULL_ACCESS_ROLES, ROLES } from '../utils/roles.js';

const FeedbackSection = lazy(() => import('../components/FeedbackSection.jsx'));
const ObservationsTab = lazy(() => import('../components/ObservationsTab.jsx'));
const PlpTab = lazy(() => import('../components/PlpTab.jsx'));
const SemesterPerformanceTab = lazy(() => import('../components/SemesterPerformanceTab.jsx'));
const ComplianceTab = lazy(() => import('../components/ComplianceTab.jsx'));

const Performance = () => {
  const { user } = useAuth();
  const location = useLocation();
  // Exact role check — subject_coordinator must NOT inherit campus_manager here.
  const canManagePlp = FULL_ACCESS_ROLES.includes(user?.role);
  const canSeeFeedback = canManagePlp || user?.role === ROLES.SUBJECT_COORDINATOR;

  const tabs = useMemo(() => {
    const next = [];
    if (canSeeFeedback) next.push({ id: 'feedback', label: 'Feedback' });
    next.push({ id: 'observations', label: 'Observations' });
    if (canManagePlp) {
      next.push({ id: 'compliance', label: 'Compliance' });
      next.push({ id: 'plp', label: 'PLP' });
      next.push({ id: 'semester-analysis', label: 'Semester analysis' });
    }
    return next;
  }, [canSeeFeedback, canManagePlp]);

  const [activeTab, setActiveTab] = useState(() => {
    const requested = new URLSearchParams(location.search).get('tab');
    return tabs.some(tab => tab.id === requested) ? requested : (tabs[0]?.id || 'observations');
  });

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('tab');
    if (tabs.some(tab => tab.id === requested)) setActiveTab(requested);
  }, [location.search, tabs]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id || 'observations');
    }
  }, [tabs, activeTab]);

  return (
    <>
      {tabs.length > 1 && (
        <ul className="nav nav-tabs mb-3" role="tablist">
          {tabs.map((tab) => (
            <li className="nav-item" key={tab.id} role="presentation">
              <AsyncButton
                type="button"
                role="tab"
                className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </AsyncButton>
            </li>
          ))}
        </ul>
      )}

      <div className="card table-card">
        <div className="card-body">
          <Suspense fallback={<LoadingSpinner message="Loading performance data…" />}>
          {activeTab === 'feedback' && canSeeFeedback && <FeedbackSection />}
          {activeTab === 'observations' && <ObservationsTab />}
          {activeTab === 'compliance' && canManagePlp && <ComplianceTab />}
          {activeTab === 'plp' && canManagePlp && <PlpTab />}
          {activeTab === 'semester-analysis' && canManagePlp && <SemesterPerformanceTab />}
          </Suspense>
        </div>
      </div>
    </>
  );
};

export default Performance;
