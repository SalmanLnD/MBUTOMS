import { useState, useEffect, useCallback, useMemo } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import CollapsibleFilters from './CollapsibleFilters.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import Modal from './Modal.jsx';
import ActionIconButton from './ActionIconButton.jsx';
import StyledSelect from './StyledSelect.jsx';
import { PlusIcon, TrashIcon, EditIcon } from './icons.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import { formatDate, getErrorMessage } from '../utils/helpers.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import {
  createCompOff,
  deleteCompOff,
  getCompOffs,
  updateCompOff,
} from '../services/compOffService.js';
import { isAbortError } from '../services/api.js';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'closed', label: 'Closed' },
];

const emptyForm = () => ({
  employeeId: '',
  name: '',
  base: 'Tirupati',
  dateWorkedOn: '',
  uniqueId: '',
  count: '1',
  status: 'pending',
  availedOn: '',
});

const CompOffsTab = () => {
  const { hasFullAccess } = useAuth();
  const canManage = hasFullAccess();

  const [rows, setRows] = useState([]);
  const [summaryByEmployee, setSummaryByEmployee] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table');

  const [employeeIdFilter, setEmployeeIdFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [baseFilter, setBaseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortField, setSortField] = useState('dateWorkedOn');
  const [sortOrder, setSortOrder] = useState('asc');

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const debouncedEmployeeId = useDebounce(employeeIdFilter);
  const debouncedName = useDebounce(nameFilter);
  const debouncedBase = useDebounce(baseFilter);

  const fetchRows = useCallback(async (signal) => {
    setLoading(true);
    try {
      const data = await getCompOffs({
        employeeId: debouncedEmployeeId || undefined,
        name: debouncedName || undefined,
        base: debouncedBase || undefined,
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      }, { signal });
      setRows(data.rows || []);
      setSummaryByEmployee(data.summaryByEmployee || []);
    } catch (err) {
      if (isAbortError(err)) return;
      showError(getErrorMessage(err));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [debouncedEmployeeId, debouncedName, debouncedBase, statusFilter, fromDate, toDate]);

  useEffect(() => {
    const controller = new AbortController();
    fetchRows(controller.signal);
    return () => controller.abort();
  }, [fetchRows]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let left = a[sortField];
      let right = b[sortField];
      if (sortField === 'dateWorkedOn' || sortField === 'availedOn') {
        left = left ? new Date(left).getTime() : 0;
        right = right ? new Date(right).getTime() : 0;
      } else if (sortField === 'count') {
        left = Number(left || 0);
        right = Number(right || 0);
      } else {
        left = String(left || '').toLowerCase();
        right = String(right || '').toLowerCase();
      }
      if (left < right) return sortOrder === 'asc' ? -1 : 1;
      if (left > right) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortField, sortOrder]);

  const totals = useMemo(() => ({
    pendingBalance: summaryByEmployee.reduce((sum, row) => sum + Number(row.pendingCount || 0), 0),
    pendingRecords: summaryByEmployee.reduce((sum, row) => sum + Number(row.pendingRecords || 0), 0),
    duplicateRecords: rows.filter((row) => row.isDuplicate).length,
    flaggedEmployees: summaryByEmployee.filter((row) => row.hasMultipleEmployeeIds).length,
  }), [summaryByEmployee, rows]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortIcon = (field) => (sortField === field ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : '');

  const openCreateModal = () => {
    setEditingRow(null);
    setForm(emptyForm());
    setShowFormModal(true);
  };

  const openEditModal = (row) => {
    setEditingRow(row);
    setForm({
      employeeId: row.employeeId,
      name: row.name,
      base: row.base,
      dateWorkedOn: row.dateWorkedOn ? row.dateWorkedOn.slice(0, 10) : '',
      uniqueId: row.uniqueId,
      count: String(row.count),
      status: row.status,
      availedOn: row.availedOn ? row.availedOn.slice(0, 10) : '',
    });
    setShowFormModal(true);
  };

  const handleSubmit = async () => {
    if (!form.employeeId.trim() || !form.name.trim() || !form.dateWorkedOn || !form.uniqueId.trim()) {
      showError('Fill employee ID, name, date worked on, and unique ID.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employeeId: form.employeeId.trim(),
        name: form.name.trim(),
        base: form.base.trim(),
        dateWorkedOn: form.dateWorkedOn,
        uniqueId: form.uniqueId.trim(),
        count: Number(form.count),
        status: form.status,
        availedOn: form.status === 'closed' && form.availedOn ? form.availedOn : null,
      };

      if (editingRow) {
        await updateCompOff(editingRow._id, payload);
        showSuccess('Comp-off updated');
      } else {
        await createCompOff(payload);
        showSuccess('Comp-off added');
      }
      setShowFormModal(false);
      fetchRows();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteCompOff(pendingDelete._id);
      showSuccess('Comp-off deleted');
      setPendingDelete(null);
      fetchRows();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  const clearFilters = () => {
    setEmployeeIdFilter('');
    setNameFilter('');
    setBaseFilter('');
    setStatusFilter('');
    setFromDate('');
    setToDate('');
  };

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h5 className="mb-1">Comp Offs</h5>
          <p className="text-muted small mb-0">
            Pending balance across visible employees: {totals.pendingBalance}
            {' · '}
            {totals.pendingRecords} pending record(s)
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <div className="btn-group btn-group-sm" role="group" aria-label="Comp-off view mode">
            <button
              type="button"
              className={`btn ${viewMode === 'table' ? 'btn-secondary' : 'btn-outline-secondary'}`}
              onClick={() => setViewMode('table')}
            >
              Table
            </button>
            <button
              type="button"
              className={`btn ${viewMode === 'summary' ? 'btn-secondary' : 'btn-outline-secondary'}`}
              onClick={() => setViewMode('summary')}
            >
              Summary
            </button>
          </div>
          {canManage && (
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreateModal}>
              <PlusIcon width={14} height={14} className="me-1" aria-hidden="true" />
              Add Comp Off
            </button>
          )}
        </div>
      </div>

      <CollapsibleFilters onClear={clearFilters}>
        <div className="row g-2">
          {canManage && (
            <div className="col-md-2">
              <label className="form-label small text-muted mb-1" htmlFor="comp-off-emp-id">Emp ID</label>
              <input
                id="comp-off-emp-id"
                type="text"
                className="form-control form-control-sm"
                value={employeeIdFilter}
                onChange={(e) => setEmployeeIdFilter(e.target.value)}
              />
            </div>
          )}
          {canManage && (
            <div className="col-md-3">
              <label className="form-label small text-muted mb-1" htmlFor="comp-off-name">Name</label>
              <input
                id="comp-off-name"
                type="text"
                className="form-control form-control-sm"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>
          )}
          <div className="col-md-2">
            <label className="form-label small text-muted mb-1" htmlFor="comp-off-base">Base</label>
            <input
              id="comp-off-base"
              type="text"
              className="form-control form-control-sm"
              value={baseFilter}
              onChange={(e) => setBaseFilter(e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label small text-muted mb-1" htmlFor="comp-off-status">Status</label>
            <StyledSelect
              id="comp-off-status"
              size="sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_OPTIONS}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label small text-muted mb-1" htmlFor="comp-off-from">Worked from</label>
            <input
              id="comp-off-from"
              type="date"
              className="form-control form-control-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label small text-muted mb-1" htmlFor="comp-off-to">Worked to</label>
            <input
              id="comp-off-to"
              type="date"
              className="form-control form-control-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      </CollapsibleFilters>

      {(totals.duplicateRecords > 0 || totals.flaggedEmployees > 0) && (
        <div className="alert alert-warning py-2 small mb-3">
          {totals.duplicateRecords > 0 && (
            <span>{totals.duplicateRecords} duplicate row(s) flagged. </span>
          )}
          {totals.flaggedEmployees > 0 && (
            <span>{totals.flaggedEmployees} employee name(s) appear under multiple Emp IDs.</span>
          )}
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading comp-offs..." />
      ) : viewMode === 'summary' ? (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Base</th>
                <th>Pending Count</th>
                <th>Closed Count</th>
                <th>Total Count</th>
                <th>Records</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {summaryByEmployee.length === 0 ? (
                <tr><td colSpan="8" className="text-center text-muted py-4">No comp-off records found</td></tr>
              ) : summaryByEmployee.map((row) => (
                <tr key={row.employeeId}>
                  <td>{row.employeeId}</td>
                  <td>{row.name}</td>
                  <td>{row.base}</td>
                  <td>{row.pendingCount}</td>
                  <td>{row.closedCount}</td>
                  <td>{row.totalCount}</td>
                  <td>{row.pendingRecords} pending / {row.closedRecords} closed</td>
                  <td>
                    {row.hasMultipleEmployeeIds && (
                      <span className="badge bg-warning text-dark me-1">Multiple Emp IDs</span>
                    )}
                    {row.duplicateRecords > 0 && (
                      <span className="badge bg-secondary">{row.duplicateRecords} duplicate(s)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => handleSort('employeeId')}>Emp ID{sortIcon('employeeId')}</button></th>
                <th><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => handleSort('name')}>Name{sortIcon('name')}</button></th>
                <th><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => handleSort('base')}>Base{sortIcon('base')}</button></th>
                <th><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => handleSort('dateWorkedOn')}>Date Worked On{sortIcon('dateWorkedOn')}</button></th>
                <th><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => handleSort('uniqueId')}>Unique ID{sortIcon('uniqueId')}</button></th>
                <th><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => handleSort('count')}>Count{sortIcon('count')}</button></th>
                <th><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => handleSort('status')}>Status{sortIcon('status')}</button></th>
                <th><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => handleSort('availedOn')}>Availed On{sortIcon('availedOn')}</button></th>
                <th>Flags</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr><td colSpan={canManage ? 10 : 9} className="text-center text-muted py-4">No comp-off records found</td></tr>
              ) : sortedRows.map((row) => (
                <tr key={row._id} className={row.isDuplicate ? 'table-warning' : undefined}>
                  <td>{row.employeeId}</td>
                  <td>{row.name}</td>
                  <td>{row.base}</td>
                  <td>{formatDate(row.dateWorkedOn)}</td>
                  <td><code className="small">{row.uniqueId}</code></td>
                  <td>{row.count}</td>
                  <td>
                    <span className={`badge ${row.status === 'closed' ? 'bg-secondary' : 'bg-success'}`}>
                      {row.status === 'closed' ? 'Closed' : 'Pending'}
                    </span>
                  </td>
                  <td>{row.availedOn ? formatDate(row.availedOn) : '—'}</td>
                  <td>
                    {row.isDuplicate && <span className="badge bg-warning text-dark me-1">Duplicate</span>}
                    {row.hasMultipleEmployeeIds && <span className="badge bg-info text-dark">Multi Emp ID</span>}
                  </td>
                  {canManage && (
                    <td>
                      <div className="d-flex gap-1">
                        <ActionIconButton
                          variant="edit"
                          icon={EditIcon}
                          title="Edit comp-off"
                          aria-label={`Edit comp-off ${row.uniqueId}`}
                          onClick={() => openEditModal(row)}
                        />
                        <ActionIconButton
                          variant="delete"
                          icon={TrashIcon}
                          title="Delete comp-off"
                          aria-label={`Delete comp-off ${row.uniqueId}`}
                          onClick={() => setPendingDelete(row)}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showFormModal && (
        <Modal
          show
          title={editingRow ? 'Edit Comp Off' : 'Add Comp Off'}
          onClose={() => !submitting && setShowFormModal(false)}
        >
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label" htmlFor="comp-off-form-emp">Emp ID</label>
              <input
                id="comp-off-form-emp"
                type="text"
                className="form-control"
                value={form.employeeId}
                onChange={(e) => setForm((prev) => ({ ...prev, employeeId: e.target.value }))}
              />
            </div>
            <div className="col-md-8">
              <label className="form-label" htmlFor="comp-off-form-name">Name</label>
              <input
                id="comp-off-form-name"
                type="text"
                className="form-control"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="comp-off-form-base">Base</label>
              <input
                id="comp-off-form-base"
                type="text"
                className="form-control"
                value={form.base}
                onChange={(e) => setForm((prev) => ({ ...prev, base: e.target.value }))}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="comp-off-form-date">Date Worked On</label>
              <input
                id="comp-off-form-date"
                type="date"
                className="form-control"
                value={form.dateWorkedOn}
                onChange={(e) => setForm((prev) => ({ ...prev, dateWorkedOn: e.target.value }))}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="comp-off-form-count">Count</label>
              <input
                id="comp-off-form-count"
                type="number"
                step="0.5"
                min="0.5"
                className="form-control"
                value={form.count}
                onChange={(e) => setForm((prev) => ({ ...prev, count: e.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="comp-off-form-uid">Unique ID</label>
              <input
                id="comp-off-form-uid"
                type="text"
                className="form-control"
                value={form.uniqueId}
                onChange={(e) => setForm((prev) => ({ ...prev, uniqueId: e.target.value }))}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="comp-off-form-status">Status</label>
              <StyledSelect
                id="comp-off-form-status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'closed', label: 'Closed' },
                ]}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="comp-off-form-availed">Availed On</label>
              <input
                id="comp-off-form-availed"
                type="date"
                className="form-control"
                value={form.availedOn}
                disabled={form.status !== 'closed'}
                onChange={(e) => setForm((prev) => ({ ...prev, availedOn: e.target.value }))}
              />
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2 mt-4">
            <button type="button" className="btn btn-outline-secondary" disabled={submitting} onClick={() => setShowFormModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmModal
          show
          title="Delete Comp Off"
          message={`Delete comp-off ${pendingDelete.uniqueId} for ${pendingDelete.name}?`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  );
};

export default CompOffsTab;
