import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import Pagination from './Pagination.jsx';
import { getFeedbackResponses } from '../services/feedbackService.js';
import { showError } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';

const FeedbackResponsesTab = () => {
  const [responses, setResponses] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [monthFilter, setMonthFilter] = useState('');

  const fetchResponses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFeedbackResponses({
        page,
        limit: 20,
        month: monthFilter || undefined,
      });
      setResponses(data.responses || []);
      setPagination(data.pagination);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, monthFilter]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  return (
    <div>
      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <input
            type="month"
            className="form-control"
            value={monthFilter}
            onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}
            aria-label="Filter by month"
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Submitted</th>
                  <th>Month</th>
                  <th>Student</th>
                  <th>Roll number</th>
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
                      <td>{new Date(row.submittedAt).toLocaleString('en-IN')}</td>
                      <td>{row.monthLabel}</td>
                      <td>{row.studentName || '-'}</td>
                      <td><code>{row.rollNumber || '-'}</code></td>
                      <td>{row.rating != null ? `${row.rating}/5` : '-'}</td>
                      <td className="text-truncate" style={{ maxWidth: '240px' }}>{row.comments || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default FeedbackResponsesTab;
