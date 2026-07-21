import { useState } from 'react';
import FeedbackSection from '../components/FeedbackSection.jsx';
import ObservationsTab from '../components/ObservationsTab.jsx';
import PlpTab from '../components/PlpTab.jsx';

const PERFORMANCE_TABS = [
  { id: 'feedback', label: 'Feedback' },
  { id: 'observations', label: 'Observations' },
  { id: 'plp', label: 'PLP' },
];

const Performance = () => {
  const [activeTab, setActiveTab] = useState('feedback');

  return (
    <>
      <ul className="nav nav-tabs mb-3" role="tablist">
        {PERFORMANCE_TABS.map((tab) => (
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

      <div className="card table-card">
        <div className="card-body">
          {activeTab === 'feedback' && <FeedbackSection />}
          {activeTab === 'observations' && <ObservationsTab />}
          {activeTab === 'plp' && <PlpTab />}
        </div>
      </div>
    </>
  );
};

export default Performance;
