import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner.jsx';
import Pagination from './Pagination.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { TrashIcon } from './icons.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { deleteTrainerPunchInLog, getTrainerPunchInLogs } from '../services/attendanceService.js';
import { formatDate, formatDateTime, formatStatus, getErrorMessage } from '../utils/helpers.js';

const SOURCE_BADGE = {
  whatsapp: 'bg-success',
  manual: 'bg-secondary',
};

const TrainerPunchInLogsTab = () => {
  const { hasRole } = useAuth();
  const canManageAll = hasRole('admin', 'campus_manager');

  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const debouncedSearch = useDebounce(search);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (sourceFilter) params.source = sourceFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const data = await getTrainerPunchInLogs(params);
      setLogs(data.logs || []);
      setPagination(data.pagination);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sourceFilter, fromDate, toDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleClearFilters = () => {
    setSearch('');
    setSourceFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteTrainerPunchInLog(pendingDelete.id);
      showSuccess('Punch-in log and attendance removed');
      setPendingDelete(null);
      fetchLogs();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const formatPhone = (phone) => {
    if (!phone) return '-';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    return phone;
  };

  const columnCount = canManageAll ? 8 : 7;

  return (
    <>
      <div className="row g-2 mb-3 align-items-end">
        {canManageAll && (
          <div className="col-md-3">
            <label className="form-label small text-muted mb-1" htmlFor="punch-log-search">
              Trainer
            </label>
            <input
              id="punch-log-search"
              type="search"
              className="form-control"
              placeholder="Search by name or ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search punch-in logs by trainer"
            />
          </div>
        )}
        <div className={canManageAll ? 'col-md-2' : 'col-md-3'}>
          <label className="form-label small text-muted mb-1" htmlFor="punch-log-source">
            Source
          </label>
          <select
            id="punch-log-source"
            className="form-select"
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by punch-in source"
          >
            <option value="">All sources</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div className="col-md-2">
          <label className="form-label small text-muted mb-1" htmlFor="punch-log-from">
            From
          </label>
          <input
            id="punch-log-from"
            type="date"
            className="form-control"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            aria-label="Filter from date"
          />
        </div>
        <div className="col-md-2">
          <label className="form-label small text-muted mb-1" htmlFor="punch-log-to">
            To
          </label>
          <input
            id="punch-log-to"
            type="date"
            className="form-control"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            aria-label="Filter to date"
          />
        </div>
        <div className="col-md-3 text-md-end">
          <button type="button" className="btn btn-outline-secondary" onClick={handleClearFilters}>
            Clear filters
          </button>
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
                  <th>Punch-in time</th>
                  <th>Attendance date</th>
                  {canManageAll && <th>Trainer</th>}
                  <th>Employee ID</th>
                  <th>OIF</th>
                  <th>Source</th>
                  <th>Phone</th>
                  {canManageAll && <th className="text-end">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="text-center text-muted py-4">
                      No punch-in logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td className="text-nowrap fw-medium">{formatDateTime(log.punchInAt)}</td>
                      <td className="text-nowrap">{formatDate(log.date)}</td>
                      {canManageAll && (
                        <td>
                          {log.trainer?._id ? (
                            <Link
                              to={`/trainers/${log.trainer._id}`}
                              className="text-decoration-none fw-medium"
                            >
                              {log.trainer.name}
                            </Link>
                          ) : (
                            '-'
                          )}
                        </td>
                      )}
                      <td>
                        <code>{log.trainer?.employeeId || '-'}</code>
                      </td>
                      <td>
                        {log.oifNumber ? (
                          <span className="badge bg-light text-dark border">{log.oifNumber}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <span className={`badge ${SOURCE_BADGE[log.punchInSource] || 'bg-secondary'}`}>
                          {formatStatus(log.punchInSource)}
                        </span>
                      </td>
                      <td className="text-nowrap">{formatPhone(log.punchInRawPhone)}</td>
                      {canManageAll && (
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center"
                            style={{ width: '2rem', height: '2rem', padding: 0 }}
                            aria-label={`Delete punch-in log for ${log.trainer?.name || 'trainer'}`}
                            title="Delete log and attendance"
                            onClick={() => setPendingDelete(log)}
                          >
                            <TrashIcon size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}

      {pendingDelete && (
        <ConfirmModal
          show
          title="Delete Punch-In Log"
          message={`Delete the punch-in for ${pendingDelete.trainer?.name || 'this trainer'} on ${formatDate(pendingDelete.date)}? This will also remove the corresponding attendance record.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
          onClose={() => !deleting && setPendingDelete(null)}
        />
      )}
    </>
  );
};

export default TrainerPunchInLogsTab;
