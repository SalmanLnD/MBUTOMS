import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import { getTopicTrackerPendingBacklog } from '../services/topicTrackerService.js';
import { getErrorMessage, formatDate } from '../utils/helpers.js';
import { showError } from '../utils/toast.js';
import { getTopicTrackerStatusBadgeClass } from '../utils/topicTrackerConstants.js';
import StyledSelect from './StyledSelect.jsx';

const computeDateParams = (range, includeToday) => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const until = new Date(`${today}T00:00:00Z`);
  if (!includeToday) until.setUTCDate(until.getUTCDate() - 1);
  const params = { until: until.toISOString().slice(0, 10) };
  if (range === 'all') return params;
  const days = parseInt(range, 10) || 30;
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - days);
  return {
    ...params,
    from: from.toISOString().slice(0, 10),
  };
};

const TopicTrackerPendingBacklogTab = ({ refreshKey = 0, onOpenTracker }) => {
  const [loading, setLoading] = useState(true);
  const [backlog, setBacklog] = useState(null);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [trainerFilter, setTrainerFilter] = useState('');
  const [rangeFilter, setRangeFilter] = useState('30');
  const [includeToday, setIncludeToday] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [loadError, setLoadError] = useState('');

  const loadBacklog = useCallback(async (selectedRange = rangeFilter) => {
    setLoading(true);
    setLoadError('');
    try {
      const params = computeDateParams(selectedRange, includeToday);
      const data = await getTopicTrackerPendingBacklog(params);
      setBacklog(data);
      setPage(1);
    } catch (err) {
      showError(getErrorMessage(err));
      setLoadError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [rangeFilter, includeToday]);

  useEffect(() => {
    loadBacklog(rangeFilter);
  }, [loadBacklog, refreshKey, rangeFilter]);

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

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  if (loading) {
    return <LoadingSpinner message="Loading pending trackers..." />;
  }

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-3">
        <div>
          <h2 className="h6 fw-semibold mb-1">Pending unclosed trackers</h2>
          <small className="text-muted">
            {backlog?.from && backlog?.until
              ? `Showing period: ${formatDate(backlog.from)} to ${formatDate(backlog.until)}`
              : 'Recent tracked classes'}
          </small>
        </div>
        <div className="d-flex flex-wrap align-items-end gap-2">
          <div style={{ minWidth: 150 }}>
            <label className="form-label mb-1" htmlFor="pending-backlog-range">Time range</label>
            <StyledSelect
              id="pending-backlog-range"
              size="sm"
              value={rangeFilter}
              onChange={(e) => setRangeFilter(e.target.value)}
              options={[
                { value: '30', label: 'Last 30 Days (Fast)' },
                { value: '60', label: 'Last 60 Days' },
                { value: 'all', label: 'All History (From July)' },
              ]}
            />
          </div>
          <div style={{ minWidth: 170 }}>
            <label className="form-label mb-1" htmlFor="pending-backlog-subject">Subject</label>
            <StyledSelect
              id="pending-backlog-subject"
              size="sm"
              value={subjectFilter}
              onChange={handleFilterChange(setSubjectFilter)}
              placeholder="All subjects"
              options={[
                { value: '', label: 'All subjects' },
                ...subjectOptions,
              ]}
            />
          </div>
          <div style={{ minWidth: 170 }}>
            <label className="form-label mb-1" htmlFor="pending-backlog-trainer">Trainer</label>
            <StyledSelect
              id="pending-backlog-trainer"
              size="sm"
              value={trainerFilter}
              onChange={handleFilterChange(setTrainerFilter)}
              placeholder="All trainers"
              options={[
                { value: '', label: 'All trainers' },
                ...trainerOptions,
              ]}
            />
          </div>
          <div className="form-check align-self-center">
            <input
              id="pending-backlog-include-today"
              className="form-check-input"
              type="checkbox"
              checked={includeToday}
              onChange={(e) => setIncludeToday(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="pending-backlog-include-today">
              Include today's slots
            </label>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadBacklog(rangeFilter)}>
            Refresh
          </button>
          <span className={`badge align-self-center ${filteredItems.length ? 'bg-warning text-dark' : 'bg-success'}`}>
            {filteredItems.length} pending
          </span>
        </div>
      </div>

      {!filteredItems.length ? (
        <div className={`alert mb-0 ${loadError ? 'alert-danger' : 'alert-light border'}`}>
          {loadError
            ? (
              <>
                Could not load pending trackers. {loadError}
                {' '}
                <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={() => loadBacklog(rangeFilter)}>
                  Retry
                </button>
              </>
            )
            : items.length
              ? 'No pending trackers match the selected filters.'
              : 'No pending unclosed topic trackers in the selected period.'}
        </div>
      ) : (
        <>
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
                {paginatedItems.map((row) => (
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

          {filteredItems.length > pageSize && (
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3 pt-2 border-top">
              <div className="text-muted small">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filteredItems.length)} of {filteredItems.length} entries
              </div>
              <div className="d-flex align-items-center gap-2">
                <select
                  className="form-select form-select-sm"
                  style={{ width: 'auto' }}
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
                <div className="btn-group btn-group-sm">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="btn btn-light disabled text-dark px-3">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TopicTrackerPendingBacklogTab;
