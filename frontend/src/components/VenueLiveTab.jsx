import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import { getLiveTrainerVenues } from '../services/scheduleService.js';
import { getErrorMessage } from '../utils/helpers.js';
import { showError } from '../utils/toast.js';

const REFRESH_MS = 60_000;

const statusLabel = (status) => {
  if (status === 'free') return 'Free';
  if (status === 'in_class_no_venue') return 'In class (no venue)';
  return 'In class';
};

const statusBadgeClass = (status) => {
  if (status === 'free') return 'bg-success';
  if (status === 'in_class_no_venue') return 'bg-warning text-dark';
  return 'bg-primary';
};

const classLabel = (schedule) => {
  if (!schedule) return '—';
  const parts = [schedule.department, schedule.section].filter(Boolean);
  const classPart = parts.length ? parts.join(' ') : '';
  if (schedule.subjectCode && classPart) return `${schedule.subjectCode} · ${classPart}`;
  return schedule.subjectCode || classPart || '—';
};

const venueLabel = (row) => {
  if (row.status === 'free') return 'Free';
  if (!row.venue) return 'No venue assigned';
  const location = row.venue.locationSummary && row.venue.locationSummary !== '—'
    ? row.venue.locationSummary
    : [row.venue.displayBuilding || row.venue.building, row.venue.displayFloor || row.venue.floor]
      .filter(Boolean)
      .join(' · ');
  return location ? `${row.venue.name} (${location})` : row.venue.name;
};

const VenueLiveTab = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchLive = useCallback(async ({ soft = false } = {}) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getLiveTrainerVenues();
      setPayload(data);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
    const timer = setInterval(() => fetchLive({ soft: true }), REFRESH_MS);
    const onFocus = () => fetchLive({ soft: true });
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchLive]);

  const rows = useMemo(() => {
    const trainers = payload?.trainers || [];
    const q = search.trim().toLowerCase();
    return trainers.filter((row) => {
      if (statusFilter === 'free' && row.status !== 'free') return false;
      if (statusFilter === 'in_class' && row.status === 'free') return false;
      if (!q) return true;
      const haystack = [
        row.name,
        row.employeeId,
        row.venue?.name,
        row.venue?.locationSummary,
        row.schedule?.subjectCode,
        row.schedule?.department,
        row.schedule?.section,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [payload, search, statusFilter]);

  const counts = useMemo(() => {
    const trainers = payload?.trainers || [];
    return {
      total: trainers.length,
      free: trainers.filter((row) => row.status === 'free').length,
      inClass: trainers.filter((row) => row.status !== 'free').length,
    };
  }, [payload]);

  if (loading && !payload) return <LoadingSpinner />;

  return (
    <div className="card table-card">
      <div className="card-body">
        <div className="row g-2 mb-3 align-items-center">
          <div className="col-md-4">
            <input
              type="search"
              className="form-control"
              placeholder="Search trainer, venue, or class..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search live venues"
            />
          </div>
          <div className="col-md-2">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="in_class">In class</option>
              <option value="free">Free</option>
            </select>
          </div>
          <div className="col-md-4">
            <div className="text-muted small">
              {payload?.day || '—'} · {payload?.currentTime || '—'} IST
              {payload?.date ? ` · ${payload.date}` : ''}
              {' · '}
              {counts.inClass} in class, {counts.free} free
              {refreshing ? ' · Refreshing…' : ''}
            </div>
          </div>
          <div className="col-md-2 text-md-end">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => fetchLive({ soft: true })}
              disabled={refreshing}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Trainer</th>
                <th>Emp ID</th>
                <th>Status</th>
                <th>Venue</th>
                <th>Class</th>
                <th>Slot</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">
                    No trainers match the current filters
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.trainerId || row.employeeId}>
                    <td className="fw-medium">{row.name}</td>
                    <td>{row.employeeId}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(row.status)}`}>
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td>{venueLabel(row)}</td>
                    <td>
                      {classLabel(row.schedule)}
                      {row.schedule?.isReplacementAssignment ? (
                        <span className="badge bg-secondary ms-2">Replacement</span>
                      ) : null}
                    </td>
                    <td>{row.schedule?.slot || '—'}</td>
                    <td>
                      {row.schedule
                        ? `${row.schedule.startTime}–${row.schedule.endTime}`
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VenueLiveTab;
