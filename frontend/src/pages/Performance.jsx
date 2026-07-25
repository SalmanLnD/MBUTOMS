import { useEffect, useMemo, useState } from 'react';
import FeedbackSection from '../components/FeedbackSection.jsx';
import ObservationsTab from '../components/ObservationsTab.jsx';
import PlpTab from '../components/PlpTab.jsx';
import ComplianceTab from '../components/ComplianceTab.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { FULL_ACCESS_ROLES, ROLES } from '../utils/roles.js';

const Performance = () => {
  const { user } = useAuth();
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
    }
    return next;
  }, [canSeeFeedback, canManagePlp]);

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'observations');

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
              <button
                type="button"
                role="tab"
                className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="card table-card">
        <div className="card-body">
          {activeTab === 'feedback' && canSeeFeedback && <FeedbackSection />}
          {activeTab === 'observations' && <ObservationsTab />}
          {activeTab === 'compliance' && canManagePlp && <ComplianceTab />}
          {activeTab === 'plp' && canManagePlp && <PlpTab />}
        </div>
      </div>
    </>
  );
};

export default Performance;
