import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import { getTopicTrackerPendingBacklog } from '../services/topicTrackerService.js';
import { getErrorMessage, formatDate } from '../utils/helpers.js';
import { showError } from '../utils/toast.js';
import { getTopicTrackerStatusBadgeClass } from '../utils/topicTrackerConstants.js';
import StyledSelect from './StyledSelect.jsx';

const TopicTrackerPendingBacklogTab = ({ refreshKey = 0, onOpenTracker }) => {
  const [loading, setLoading] = useState(true);
  const [backlog, setBacklog] = useState(null);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [trainerFilter, setTrainerFilter] = useState('');

  const loadBacklog = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTopicTrackerPendingBacklog();
      setBacklog(data);
    } catch (err) {
      showError(getErrorMessage(err));
      setBacklog({ items: [], totalPending: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBacklog();
  }, [loadBacklog, refreshKey]);

  const items = backlog?.items || [];

  const subjectOptions = useMemo(() => {
    const map = new Map();
    items.forEach((row) => {
      const key = row.subjectId || row.subjectCode || row.courseName;
      if (!key || map.has(key)) return;
      map.set(key, {
        value: key,
        label: row.subjectCode
          ? `${row.courseName || row.subjectCode} (${row.subjectCode})`
          : (row.courseName || 'Subject'),
      });
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  const trainerOptions = useMemo(() => {
    const map = new Map();
    items.forEach((row) => {
      if (!row.trainerId || map.has(row.trainerId)) return;
      map.set(row.trainerId, {
        value: row.trainerId,
        label: row.trainerName || 'Trainer',
      });
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  const filteredItems = useMemo(() => items.filter((row) => {
    if (subjectFilter) {
      const key = row.subjectId || row.subjectCode || row.courseName;
      if (key !== subjectFilter) return false;
    }
    if (trainerFilter && row.trainerId !== trainerFilter) return false;
    return true;
  }), [items, subjectFilter, trainerFilter]);

  if (loading) {
    return <LoadingSpinner message="Loading pending trackers..." />;
  }

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-3">
        <div>
          <h2 className="h6 fw-semibold mb-1">Pending unclosed trackers</h2>
          <p className="text-muted small mb-0">
            All open slots from{' '}
            {backlog?.from ? formatDate(backlog.from) : 'tracking start'} through{' '}
            {backlog?.until ? formatDate(backlog.until) : 'today'}. Day overview still shows one
            date at a time.
          </p>
        </div>
        <div className="d-flex flex-wrap align-items-end gap-2">
          <div style={{ minWidth: 180 }}>
            <label className="form-label mb-1" htmlFor="pending-backlog-subject">Subject</label>
            <StyledSelect
              id="pending-backlog-subject"
              size="sm"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              placeholder="All subjects"
              options={[
                { value: '', label: 'All subjects' },
                ...subjectOptions,
              ]}
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <label className="form-label mb-1" htmlFor="pending-backlog-trainer">Trainer</label>
            <StyledSelect
              id="pending-backlog-trainer"
              size="sm"
              value={trainerFilter}
              onChange={(e) => setTrainerFilter(e.target.value)}
              placeholder="All trainers"
              options={[
                { value: '', label: 'All trainers' },
                ...trainerOptions,
              ]}
            />
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loadBacklog}>
            Refresh
          </button>
          <span className={`badge align-self-center ${filteredItems.length ? 'bg-warning text-dark' : 'bg-success'}`}>
            {filteredItems.length} pending
          </span>
        </div>
      </div>

      {!filteredItems.length ? (
        <div className="alert alert-light border mb-0">
          {items.length
            ? 'No pending trackers match the selected filters.'
            : 'No pending unclosed topic trackers through today.'}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th>Trainer</th>
                <th>Slot</th>
                <th>Time</th>
                <th>Class</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((row) => (
                <tr key={`${row.date}|${row.scheduleId}`}>
                  <td>{formatDate(row.date)}</td>
                  <td>
                    <div>{row.courseName || '—'}</div>
                    {row.subjectCode ? (
                      <small className="text-muted">{row.subjectCode}</small>
                    ) : null}
                  </td>
                  <td>{row.trainerName || '—'}</td>
                  <td>{row.slot || '—'}</td>
                  <td>
                    {row.sessionStartTime && row.sessionEndTime
                      ? `${row.sessionStartTime}–${row.sessionEndTime}`
                      : '—'}
                  </td>
                  <td>{row.branchYearSection || '—'}</td>
                  <td>
                    <span className={`badge ${getTopicTrackerStatusBadgeClass(row.trackerStatus)}`}>
                      Pending
                    </span>
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => onOpenTracker?.({
                        date: row.date,
                        subjectId: row.subjectId || undefined,
                        trainerId: row.trainerId || undefined,
                        title: `${row.trainerName || 'Trainer'} — ${row.courseName || 'Subject'} — ${row.date}`,
                        scheduleId: row.scheduleId,
                        entryId: row.entryId || undefined,
                      })}
                    >
                      Open tracker
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TopicTrackerPendingBacklogTab;
