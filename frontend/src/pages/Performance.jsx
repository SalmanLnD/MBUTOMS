import { useEffect, useState } from 'react';
import FeedbackSection from '../components/FeedbackSection.jsx';
import ObservationsTab from '../components/ObservationsTab.jsx';
import PlpTab from '../components/PlpTab.jsx';
import ComplianceTab from '../components/ComplianceTab.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const ALL_PERFORMANCE_TABS = [
  { id: 'feedback', label: 'Feedback' },
  { id: 'observations', label: 'Observations' },
  { id: 'plp', label: 'PLP' },
  { id: 'compliance', label: 'Compliance' },
];

const OBSERVATIONS_ONLY_TABS = [
  { id: 'observations', label: 'Observations' },
];

const Performance = () => {
  const { hasManagementRole } = useAuth();
  const showAllTabs = hasManagementRole();
  const tabs = showAllTabs ? ALL_PERFORMANCE_TABS : OBSERVATIONS_ONLY_TABS;
  const [activeTab, setActiveTab] = useState(showAllTabs ? 'feedback' : 'observations');

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
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
          {activeTab === 'feedback' && showAllTabs && <FeedbackSection />}
          {activeTab === 'observations' && <ObservationsTab />}
          {activeTab === 'plp' && showAllTabs && <PlpTab />}
          {activeTab === 'compliance' && showAllTabs && <ComplianceTab />}
        </div>
      </div>
    </>
  );
};

export default Performance;
