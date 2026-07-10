import { useState, useEffect, useCallback } from 'react';
import Topbar from '../components/Topbar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import FeedbackSummaryTab from '../components/FeedbackSummaryTab.jsx';
import FeedbackResponsesTab from '../components/FeedbackResponsesTab.jsx';
import FeedbackFormTab from '../components/FeedbackFormTab.jsx';
import { getFeedbackSummary } from '../services/feedbackService.js';
import { showError } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';

const Performance = () => {
  const [activeTab, setActiveTab] = useState('summary');
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
    if (activeTab === 'summary') {
      loadSummary();
    }
  }, [activeTab, loadSummary]);

  return (
    <>
      <Topbar title="Performance" />

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button type="button" className={`nav-link ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>
            Summary
          </button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link ${activeTab === 'responses' ? 'active' : ''}`} onClick={() => setActiveTab('responses')}>
            Response logs
          </button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link ${activeTab === 'forms' ? 'active' : ''}`} onClick={() => setActiveTab('forms')}>
            Feedback form
          </button>
        </li>
      </ul>

      <div className="card table-card">
        <div className="card-body">
          {activeTab === 'summary' && (
            <FeedbackSummaryTab summary={summary} loading={loadingSummary} />
          )}
          {activeTab === 'responses' && <FeedbackResponsesTab />}
          {activeTab === 'forms' && <FeedbackFormTab />}
        </div>
      </div>
    </>
  );
};

export default Performance;
