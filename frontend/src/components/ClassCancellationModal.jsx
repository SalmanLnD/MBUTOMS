import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import { TrashIcon } from './icons.jsx';
import {
  createClassCancellation,
  deleteClassCancellation,
  getClassCancellationOptions,
} from '../services/scheduleService.js';
import { getErrorMessage } from '../utils/helpers.js';
import { showError, showSuccess } from '../utils/toast.js';

const scopeOptions = [
  { value: 'classes', label: 'One or more selected classes' },
  { value: 'school', label: 'Every class in one school' },
  { value: 'all', label: 'All classes for the college' },
];

const scheduleLabel = (schedule) => [
  schedule.startTime && schedule.endTime
    ? `${schedule.startTime}–${schedule.endTime}`
    : schedule.slot,
  `${schedule.department} ${schedule.section}`,
  schedule.subjectCode,
  schedule.trainerCode,
].filter(Boolean).join(' · ');

const cancellationScopeLabel = (entry) => {
  if (entry.scope === 'all') return 'All college classes';
  if (entry.scope === 'school') {
    return `${entry.school?.name || entry.school?.code || 'School'} classes`;
  }
  return `${entry.schedules?.length || 0} selected class${entry.schedules?.length === 1 ? '' : 'es'}`;
};

const ClassCancellationModal = ({ show, initialDate, onClose, onChanged }) => {
  const [date, setDate] = useState(initialDate);
  const [scope, setScope] = useState('classes');
  const [schoolId, setSchoolId] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const loadOptions = useCallback(async (selectedDate) => {
    setLoading(true);
    try {
      const result = await getClassCancellationOptions(selectedDate);
      setData(result);
      setSelectedIds([]);
    } catch (error) {
      setData(null);
      showError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    setDate(initialDate);
    setScope('classes');
    setSchoolId('');
    setReason('');
    setSearch('');
    loadOptions(initialDate);
  }, [show, initialDate, loadOptions]);

  const availableSchedules = useMemo(
    () => (data?.schedules || []).filter((schedule) => !schedule.isCanceled),
    [data]
  );

  const visibleSchedules = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return availableSchedules;
    return availableSchedules.filter((schedule) =>
      scheduleLabel(schedule).toLowerCase().includes(term)
    );
  }, [availableSchedules, search]);

  const toggleSchedule = (scheduleId) => {
    setSelectedIds((current) =>
      current.includes(scheduleId)
        ? current.filter((id) => id !== scheduleId)
        : [...current, scheduleId]
    );
  };

  const selectVisible = () => {
    const visibleIds = visibleSchedules.map((schedule) => schedule._id);
    setSelectedIds((current) => [...new Set([...current, ...visibleIds])]);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (scope === 'classes' && !selectedIds.length) {
      showError('Select at least one class.');
      return;
    }
    if (scope === 'school' && !schoolId) {
      showError('Select a school.');
      return;
    }

    setSaving(true);
    try {
      const created = await createClassCancellation({
        date,
        scope,
        scheduleIds: scope === 'classes' ? selectedIds : undefined,
        schoolId: scope === 'school' ? schoolId : undefined,
        reason,
      });
      showSuccess(`${created.schedules?.length || 0} class schedule(s) canceled for ${date}.`);
      await loadOptions(date);
      await onChanged?.(date);
    } catch (error) {
      showError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteClassCancellation(pendingDelete._id);
      showSuccess('Class cancellation removed.');
      setPendingDelete(null);
      await loadOptions(date);
      await onChanged?.(date);
    } catch (error) {
      showError(getErrorMessage(error));
    }
  };

  const footer = (
    <>
      <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
        Close
      </button>
      <button type="submit" form="class-cancellation-form" className="btn btn-danger" disabled={saving || loading}>
        {saving ? 'Applying cancellation...' : 'Apply cancellation'}
      </button>
    </>
  );

  return (
    <>
      <Modal
        show={show}
        title="Cancel Scheduled Classes"
        onClose={onClose}
        footer={footer}
        size="toms-modal-xl"
        scrollable
        dismissible={!saving}
      >
        <form id="class-cancellation-form" className="toms-modal-body" onSubmit={submit}>
          <div className="alert alert-warning">
            Cancellations apply only to the selected calendar date. Canceled schedules are excluded
            from trainer class-handling hours, leave affected-class counts, and replacement
            assignments for that date.
          </div>

          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label htmlFor="class-cancellation-date" className="form-label fw-semibold">Date</label>
              <input
                id="class-cancellation-date"
                type="date"
                className="form-control"
                value={date}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  setDate(nextDate);
                  if (nextDate) loadOptions(nextDate);
                }}
                required
              />
              {data?.day && <div className="form-text">{data.day}</div>}
            </div>
            <div className="col-md-8">
              <label className="form-label fw-semibold">Cancellation scope</label>
              <div className="d-flex flex-wrap gap-3">
                {scopeOptions.map((option) => (
                  <div className="form-check" key={option.value}>
                    <input
                      className="form-check-input"
                      type="radio"
                      name="cancellation-scope"
                      id={`cancellation-scope-${option.value}`}
                      value={option.value}
                      checked={scope === option.value}
                      onChange={(event) => setScope(event.target.value)}
                    />
                    <label className="form-check-label" htmlFor={`cancellation-scope-${option.value}`}>
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner message="Loading scheduled classes..." />
          ) : (
            <>
              {scope === 'classes' && (
                <div className="mb-3">
                  <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-2">
                    <div className="flex-grow-1">
                      <label htmlFor="class-cancellation-search" className="form-label fw-semibold">
                        Select classes ({selectedIds.length} selected)
                      </label>
                      <input
                        id="class-cancellation-search"
                        type="search"
                        className="form-control"
                        placeholder="Filter by trainer, subject, class, or time..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={selectVisible}>
                        Select visible
                      </button>
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedIds([])}>
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="class-cancellation-schedule-list border rounded p-2">
                    {!visibleSchedules.length ? (
                      <p className="text-muted mb-0 p-2">No available classes match this date and filter.</p>
                    ) : visibleSchedules.map((schedule) => (
                      <label className="class-cancellation-schedule-option" key={schedule._id}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selectedIds.includes(schedule._id)}
                          onChange={() => toggleSchedule(schedule._id)}
                        />
                        <span>{scheduleLabel(schedule)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {scope === 'school' && (
                <div className="mb-3">
                  <label htmlFor="class-cancellation-school" className="form-label fw-semibold">School</label>
                  <select
                    id="class-cancellation-school"
                    className="form-select"
                    value={schoolId}
                    onChange={(event) => setSchoolId(event.target.value)}
                    required
                  >
                    <option value="">Select school...</option>
                    {(data?.schools || []).map((school) => (
                      <option key={school._id} value={school._id}>
                        {school.name} ({school.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {scope === 'all' && (
                <div className="alert alert-danger">
                  This will cancel every scheduled class on {date} ({data?.day}).
                </div>
              )}

              <div className="mb-3">
                <label htmlFor="class-cancellation-reason" className="form-label fw-semibold">
                  Reason (optional)
                </label>
                <textarea
                  id="class-cancellation-reason"
                  className="form-control"
                  rows="2"
                  maxLength="300"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Example: College holiday"
                />
              </div>

              {(data?.cancellations || []).length > 0 && (
                <div className="mt-4">
                  <h6>Existing cancellations for {date}</h6>
                  <div className="list-group">
                    {data.cancellations.map((entry) => (
                      <div className="list-group-item d-flex justify-content-between align-items-start gap-3" key={entry._id}>
                        <div>
                          <div className="fw-semibold">{cancellationScopeLabel(entry)}</div>
                          <div className="text-muted small">
                            {entry.schedules?.length || 0} schedule(s)
                            {entry.reason ? ` · ${entry.reason}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1"
                          onClick={() => setPendingDelete(entry)}
                          aria-label="Remove cancellation"
                        >
                          <TrashIcon size={14} aria-hidden="true" />
                          Undo
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </form>
      </Modal>

      {pendingDelete && (
        <ConfirmModal
          show
          title="Undo Class Cancellation"
          message={`Restore ${pendingDelete.schedules?.length || 0} canceled schedule(s) for ${date}?`}
          confirmLabel="Restore classes"
          confirmVariant="danger"
          onConfirm={confirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  );
};

export default ClassCancellationModal;
