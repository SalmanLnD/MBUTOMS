import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import Pagination from './Pagination.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import ComplianceFormModal from './ComplianceFormModal.jsx';
import { TrashIcon } from './icons.jsx';
import ActionIconButton from './ActionIconButton.jsx';
import {
  deleteCompliance,
  getComplianceList,
  getComplianceTrainers,
} from '../services/plpService.js';
import {
  buildMonthOptions,
  clampMonthParts,
  formatMonthKey,
  getCurrentMonthParts,
} from '../utils/monthDates.js';
import { formatDate, getErrorMessage } from '../utils/helpers.js';
import { showError, showSuccess } from '../utils/toast.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { usePagination } from '../hooks/usePagination.js';
import { isAbortError } from '../services/api.js';

const ComplianceTab = () => {
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [monthKey, setMonthKey] = useState(() => {
    const parts = clampMonthParts(getCurrentMonthParts());
    return formatMonthKey(parts.year, parts.month);
  });
  const [trainerSearch, setTrainerSearch] = useState('');
  const debouncedSearch = useDebounce(trainerSearch);
  const [items, setItems] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const {
    page,
    setPage,
    pageSize,
    changePageSize,
    pagination,
    setPagination,
  } = usePagination({ initialPageSize: 20 });

  const loadTrainers = useCallback(async () => {
    try {
      const data = await getComplianceTrainers();
      setTrainers(data.trainers || []);
    } catch {
      setTrainers([]);
    }
  }, []);

  const loadItems = useCallback(async (signal) => {
    setLoading(true);
    try {
      const data = await getComplianceList({
        month: monthKey,
        search: debouncedSearch,
        page,
        limit: pageSize,
      }, { signal });
      setItems(data.items || []);
      setPagination(data.pagination);
    } catch (err) {
      if (isAbortError(err)) return;
      showError(getErrorMessage(err));
      setItems([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [monthKey, debouncedSearch, page, pageSize, setPagination]);

  useEffect(() => {
    loadTrainers();
  }, [loadTrainers]);

  useEffect(() => {
    const controller = new AbortController();
    loadItems(controller.signal);
    return () => controller.abort();
  }, [loadItems]);

  useEffect(() => {
    setPage(1);
  }, [monthKey, debouncedSearch, setPage]);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteCompliance(pendingDelete._id);
      showSuccess('Compliance record deleted');
      setPendingDelete(null);
      loadItems();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  return (
    <>
      <div className="row g-2 mb-3 align-items-end">
        <div className="col-md-3">
          <label className="form-label" htmlFor="compliance-month-filter">Month</label>
          <select
            id="compliance-month-filter"
            className="form-select"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-5">
          <label className="form-label" htmlFor="compliance-trainer-filter">Trainer</label>
          <input
            id="compliance-trainer-filter"
            type="search"
            className="form-control"
            placeholder="Filter by trainer name or employee ID..."
            value={trainerSearch}
            onChange={(e) => setTrainerSearch(e.target.value)}
          />
        </div>
        <div className="col-md-4 text-md-end">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            Add compliance
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
                  <th>Date</th>
                  <th>Month</th>
                  <th>Trainer</th>
                  <th>Employee ID</th>
                  <th>Remark</th>
                  <th>Recorded by</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No compliance records for this filter.
                    </td>
                  </tr>
                ) : items.map((item) => (
                  <tr key={item._id}>
                    <td>{formatDate(item.date || item.dateKey)}</td>
                    <td>{item.monthKey}</td>
                    <td>{item.trainer?.name || '—'}</td>
                    <td>{item.trainer?.employeeId || '—'}</td>
                    <td style={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>{item.remark}</td>
                    <td>{item.createdBy?.name || '—'}</td>
                    <td className="text-end">
                      <ActionIconButton
                        variant="delete"
                        icon={TrashIcon}
                        title="Delete compliance"
                        aria-label={`Delete compliance for ${item.trainer?.name || 'trainer'}`}
                        onClick={() => setPendingDelete(item)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            pagination={pagination}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={changePageSize}
            showSummary
          />
        </>
      )}

      {showAddModal && (
        <ComplianceFormModal
          show
          trainers={trainers}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            showSuccess('Compliance recorded');
            loadItems();
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          show
          title="Delete Compliance"
          message={`Delete compliance for "${pendingDelete.trainer?.name || 'trainer'}" on ${formatDate(pendingDelete.date || pendingDelete.dateKey)}? This restores 1 compliance point for that month.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  );
};

export default ComplianceTab;
