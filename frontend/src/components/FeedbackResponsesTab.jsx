import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import Pagination from './Pagination.jsx';
import FeedbackSheetSetupModal from './FeedbackSheetSetupModal.jsx';
import { getFeedbackResponses, getFeedbackSheetStatus } from '../services/feedbackService.js';
import { getTrainers } from '../services/trainerService.js';
import { showError } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';
import { SheetIcon, ExternalLinkIcon } from './icons.jsx';
import '../styles/feedback-forms.css';

const FeedbackResponsesTab = () => {
  const [responses, setResponses] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [monthFilter, setMonthFilter] = useState('');
  const [trainerFilter, setTrainerFilter] = useState('');
  const [trainers, setTrainers] = useState([]);
  const [sheetStatus, setSheetStatus] = useState(null);
  const [sheetModalOpen, setSheetModalOpen] = useState(false);

  const fetchResponses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFeedbackResponses({
        page,
        limit: 20,
        month: monthFilter || undefined,
        trainer: trainerFilter || undefined,
      });
      setResponses(data.responses || []);
      setPagination(data.pagination);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, monthFilter, trainerFilter]);

  const loadSheetStatus = useCallback(async () => {
    try {
      const status = await getFeedbackSheetStatus();
      setSheetStatus(status);
    } catch {
      setSheetStatus(null);
    }
  }, []);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  useEffect(() => {
    loadSheetStatus();
  }, [loadSheetStatus, sheetModalOpen]);

  useEffect(() => {
    const loadTrainers = async () => {
      try {
        const data = await getTrainers({ limit: 200, sortBy: 'name', sortOrder: 'asc' });
        setTrainers(data.trainers || data || []);
      } catch {
        setTrainers([]);
      }
    };
    loadTrainers();
  }, []);

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
        <div className="d-flex flex-wrap align-items-end gap-2 flex-grow-1">
          <div style={{ minWidth: '180px', maxWidth: '240px' }}>
            <label className="form-label mb-1" htmlFor="feedback-month-filter">Filter by month</label>
            <input
              id="feedback-month-filter"
              type="month"
              className="form-control"
              value={monthFilter}
              onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}
              aria-label="Filter by month"
            />
          </div>
          <div style={{ minWidth: '200px', maxWidth: '280px' }}>
            <label className="form-label mb-1" htmlFor="feedback-trainer-filter">Filter by trainer</label>
            <select
              id="feedback-trainer-filter"
              className="form-select"
              value={trainerFilter}
              onChange={(e) => { setTrainerFilter(e.target.value); setPage(1); }}
              aria-label="Filter by trainer"
            >
              <option value="">All trainers</option>
              {trainers.map((trainer) => (
                <option key={trainer._id} value={trainer._id}>
                  {trainer.name}
                  {trainer.employeeId ? ` (${trainer.employeeId})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2">
          {sheetStatus?.spreadsheetUrl && (
            <a
              href={sheetStatus.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
            >
              <ExternalLinkIcon size={16} />
              Open linked sheet
            </a>
          )}
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
            onClick={() => setSheetModalOpen(true)}
          >
            <SheetIcon size={16} />
            Link Google Sheet
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-hover align-top feedback-responses-table">
              <thead className="table-light">
                <tr>
                  <th>Submitted</th>
                  <th>Student</th>
                  <th>Roll number</th>
                  <th>Trainer</th>
                  <th>Rating</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {responses.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted py-4">No responses yet</td>
                  </tr>
                ) : (
                  responses.map((row) => (
                    <tr key={row.id}>
                      <td className="text-nowrap">{new Date(row.submittedAt).toLocaleString('en-IN')}</td>
                      <td>{row.studentName || '-'}</td>
                      <td><code>{row.rollNumber || '-'}</code></td>
                      <td>{row.trainer?.name || '-'}</td>
                      <td>{row.rating != null ? `${row.rating}/5` : '-'}</td>
                      <td className="feedback-response-comments">{row.comments || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}

      {sheetModalOpen && (
        <FeedbackSheetSetupModal
          show
          initialUrl={sheetStatus?.spreadsheetUrl || ''}
          onClose={() => setSheetModalOpen(false)}
          onLinked={() => {
            setSheetModalOpen(false);
            loadSheetStatus();
          }}
        />
      )}
    </div>
  );
};

export default FeedbackResponsesTab;
