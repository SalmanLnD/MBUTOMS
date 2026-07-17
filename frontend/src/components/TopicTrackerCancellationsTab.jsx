import { useCallback, useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import {
  getCancellationApprovals,
  reviewCancellationApproval,
} from '../services/topicTrackerService.js';
import { getErrorMessage, formatDate } from '../utils/helpers.js';
import { showError, showSuccess } from '../utils/toast.js';
import {
  SESSION_STATUS_LABELS,
  getSessionStatusBadgeClass,
} from '../utils/topicTrackerConstants.js';

const TopicTrackerCancellationsTab = ({ highlightEntryId, onHighlightComplete }) => {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCancellationApprovals(statusFilter);
      setEntries(data.entries || []);
    } catch (err) {
      showError(getErrorMessage(err));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (!highlightEntryId || loading) return;
    const row = document.getElementById(`cancel-approval-${highlightEntryId}`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('table-warning');
      const timer = window.setTimeout(() => {
        row.classList.remove('table-warning');
        onHighlightComplete?.();
      }, 2500);
      return () => window.clearTimeout(timer);
    }
    onHighlightComplete?.();
    return undefined;
  }, [highlightEntryId, loading, entries, onHighlightComplete]);

  const handleConfirm = async () => {
    if (!pendingAction || submitting) return;
    setSubmitting(true);
    try {
      await reviewCancellationApproval(pendingAction.entry._id, pendingAction.status);
      showSuccess(
        pendingAction.status === 'approved'
          ? 'Approved. Class hours removed from trainer attendance for that day.'
          : 'Rejected. Trainer hours are unchanged.'
      );
      setPendingAction(null);
      await loadEntries();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
        <div>
          <h2 className="h6 fw-semibold mb-1">Cancelled / postponed sessions</h2>
          <p className="text-muted small mb-0">
            Approve to deduct those slot hours from the trainer&apos;s attendance for that day.
          </p>
        </div>
        <div style={{ minWidth: '10rem' }}>
          <label className="form-label mb-1" htmlFor="cancel-approval-filter">Show</label>
          <select
            id="cancel-approval-filter"
            className="form-select form-select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="pending">Pending approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading cancelled sessions..." />
      ) : entries.length === 0 ? (
        <div className="alert alert-light border mb-0">
          {statusFilter === 'pending'
            ? 'No cancelled or postponed sessions waiting for approval.'
            : 'No matching sessions.'}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Date</th>
                <th>Trainer</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Time</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Marked by</th>
                {statusFilter === 'pending' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const approval = entry.cancellationApprovalStatus || 'pending';
                const canReview = approval === 'pending' || approval === 'none';
                return (
                  <tr key={entry._id} id={`cancel-approval-${entry._id}`}>
                    <td>{formatDate(entry.date)}</td>
                    <td>
                      {entry.trainerName || entry.trainer?.name || '—'}
                      {entry.trainer?.employeeId ? (
                        <span className="text-muted small d-block">{entry.trainer.employeeId}</span>
                      ) : null}
                    </td>
                    <td>{entry.branchYearSection || '—'}</td>
                    <td>
                      {entry.courseName || entry.subject?.name || '—'}
                      {entry.slot ? (
                        <span className="text-muted small d-block">{entry.slot}</span>
                      ) : null}
                    </td>
                    <td>
                      {[entry.sessionStartTime, entry.sessionEndTime].filter(Boolean).join(' – ') || '—'}
                    </td>
                    <td>{Number(entry.durationHrs || 0).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${getSessionStatusBadgeClass(entry.sessionStatus)}`}>
                        {SESSION_STATUS_LABELS[entry.sessionStatus] || entry.sessionStatus}
                      </span>
                      {approval !== 'pending' && approval !== 'none' && (
                        <span className="badge bg-secondary ms-1 text-capitalize">{approval}</span>
                      )}
                    </td>
                    <td className="small">{entry.markedBy?.name || '—'}</td>
                    {statusFilter === 'pending' && (
                      <td>
                        {canReview ? (
                          <div className="btn-group btn-group-sm">
                            <button
                              type="button"
                              className="btn btn-outline-success"
                              onClick={() => setPendingAction({ entry, status: 'approved' })}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              onClick={() => setPendingAction({ entry, status: 'rejected' })}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted small text-capitalize">{approval}</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pendingAction && (
        <ConfirmModal
          show
          title={pendingAction.status === 'approved' ? 'Approve cancellation' : 'Reject cancellation'}
          message={
            pendingAction.status === 'approved'
              ? `Approve ${pendingAction.entry.sessionStatus} for ${
                pendingAction.entry.trainerName || 'this trainer'
              } on ${formatDate(pendingAction.entry.date)}? This removes ${
                Number(pendingAction.entry.durationHrs || 0).toFixed(2)
              } hour(s) from their attendance for that day.`
              : `Reject this ${pendingAction.entry.sessionStatus} report? Trainer attendance hours will stay unchanged.`
          }
          confirmLabel={pendingAction.status === 'approved' ? 'Approve & deduct hours' : 'Reject'}
          confirmVariant={pendingAction.status === 'approved' ? 'success' : 'danger'}
          onConfirm={handleConfirm}
          onClose={() => {
            if (!submitting) setPendingAction(null);
          }}
        />
      )}
    </div>
  );
};

export default TopicTrackerCancellationsTab;
