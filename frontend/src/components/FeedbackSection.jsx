import { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import FeedbackSummaryTab from './FeedbackSummaryTab.jsx';
import FeedbackResponsesTab from './FeedbackResponsesTab.jsx';
import FeedbackFormTab from './FeedbackFormTab.jsx';
import { getFeedbackSummary } from '../services/feedbackService.js';
import { showError } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';

const FEEDBACK_SUB_TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'responses', label: 'Response logs' },
  { id: 'forms', label: 'Feedback form' },
];

const FeedbackSection = () => {
  const [activeSubTab, setActiveSubTab] = useState('summary');
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await getFeedbackSummary();
      setSummary(data);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'summary') {
      loadSummary();
    }
  }, [activeSubTab, loadSummary]);

  return (
    <>
      <ul className="nav nav-tabs mb-3" role="tablist">
        {FEEDBACK_SUB_TABS.map((tab) => (
          <li className="nav-item" key={tab.id} role="presentation">
            <button
              type="button"
              role="tab"
              className={`nav-link ${activeSubTab === tab.id ? 'active' : ''}`}
              aria-selected={activeSubTab === tab.id}
              onClick={() => setActiveSubTab(tab.id)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {activeSubTab === 'summary' && (
        <FeedbackSummaryTab summary={summary} loading={loadingSummary} />
      )}
      {activeSubTab === 'responses' && <FeedbackResponsesTab />}
      {activeSubTab === 'forms' && <FeedbackFormTab />}
    </>
  );
};

export default FeedbackSection;
