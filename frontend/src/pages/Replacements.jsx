import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import { formatDate, getErrorMessage } from '../utils/helpers.js';
import { formatTimeRange } from '../utils/scheduleUtils.js';
import Modal from '../components/Modal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import TrainerAvailabilityPanel from '../components/TrainerAvailabilityPanel.jsx';
import AddSlotReplacementModal from '../components/AddSlotReplacementModal.jsx';
import { EditIcon, TrashIcon } from '../components/icons.jsx';
import ActionIconButton from '../components/ActionIconButton.jsx';
import Pagination from '../components/Pagination.jsx';
import { usePagination } from '../hooks/usePagination.js';
import {
  getAllReplacements,
  getReplacementSuggestions,
  assignReplacement,
  cancelReplacement,
  getBulkReplacementSuggestions,
  assignBulkReplacement,
} from '../services/replacementService.js';
import { getTrainers } from '../services/trainerService.js';

const REPLACEMENT_STATUS = {
  current: { label: 'Current', className: 'bg-success' },
  upcoming: { label: 'Upcoming', className: 'bg-info text-dark' },
  pending_approval: { label: 'Pending approval', className: 'bg-warning text-dark' },
  previous: { label: 'Previous', className: 'bg-secondary' },
  rejected: { label: 'Rejected', className: 'bg-danger' },
  cancelled: { label: 'Cancelled', className: 'bg-dark' },
};

const Replacements = () => {
  const {
    page,
    setPage,
    pageSize,
    changePageSize,
    pagination,
    setPagination,
  } = usePagination({ initialPageSize: 10 });
  const [activeTab, setActiveTab] = useState('all');
  const [replacements, setReplacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedLeaveId, setSelectedLeaveId] = useState('');
  const [changingReplacement, setChangingReplacement] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [otherSuggestions, setOtherSuggestions] = useState([]);
  const [suggestionSubject, setSuggestionSubject] = useState(null);
  const [suggestionFilter, setSuggestionFilter] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [externalTrainerName, setExternalTrainerName] = useState('');
  const [assigningExternal, setAssigningExternal] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(null);
  const [registerFilter, setRegisterFilter] = useState('all');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [loadingBulkSuggestions, setLoadingBulkSuggestions] = useState(false);
  const [bulkTrainerOptions, setBulkTrainerOptions] = useState([]);
  const [bulkSuggestions, setBulkSuggestions] = useState([]);
  const [bulkTargetCount, setBulkTargetCount] = useState(0);
  const [bulkForm, setBulkForm] = useState({
    sourceTrainerId: '',
    fromDate: '',
    toDate: '',
    mode: 'internal',
    replacementTrainerId: '',
    externalTrainerName: '',
    externalEmployeeId: '',
    externalEmail: '',
  });

  const fetchReplacements = async () => {
    setLoading(true);
    try {
      const data = await getAllReplacements({
        page,
        limit: pageSize,
        registerFilter,
      });
      setReplacements(data.replacements || []);
      setPagination(data.pagination || null);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReplacements(); }, [page, pageSize, registerFilter]);

  const resetBulkForm = () => {
    setBulkForm({
      sourceTrainerId: '',
      fromDate: '',
      toDate: '',
      mode: 'internal',
      replacementTrainerId: '',
      externalTrainerName: '',
      externalEmployeeId: '',
      externalEmail: '',
    });
    setBulkSuggestions([]);
    setBulkTargetCount(0);
  };

  const openBulkModal = async () => {
    setShowBulkModal(true);
    resetBulkForm();
    try {
      const data = await getTrainers({ fields: 'lite', limit: 200, sortBy: 'name', sortOrder: 'asc' });
      setBulkTrainerOptions(data.trainers || []);
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  const loadBulkSuggestions = async () => {
    if (!bulkForm.sourceTrainerId || !bulkForm.fromDate || !bulkForm.toDate) {
      showError('Select trainer and date range first');
      return;
    }
    setLoadingBulkSuggestions(true);
    try {
      const data = await getBulkReplacementSuggestions({
        sourceTrainerId: bulkForm.sourceTrainerId,
        fromDate: bulkForm.fromDate,
        toDate: bulkForm.toDate,
      });
      setBulkSuggestions(data.suggestions || []);
      setBulkTargetCount(data.targetCount || 0);
    } catch (err) {
      showError(getErrorMessage(err));
      setBulkSuggestions([]);
      setBulkTargetCount(0);
    } finally {
      setLoadingBulkSuggestions(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkForm.sourceTrainerId || !bulkForm.fromDate || !bulkForm.toDate) {
      showError('Select trainer and date range');
      return;
    }

    if (bulkForm.mode === 'internal' && !bulkForm.replacementTrainerId) {
      showError('Select a replacement trainer');
      return;
    }
    if (bulkForm.mode === 'external'
      && (!bulkForm.externalTrainerName.trim()
        || !bulkForm.externalEmployeeId.trim()
        || !bulkForm.externalEmail.trim())) {
      showError('Enter external trainer name, employee ID, and email');
      return;
    }

    setBulkSubmitting(true);
    try {
      const payload = {
        sourceTrainerId: bulkForm.sourceTrainerId,
        fromDate: bulkForm.fromDate,
        toDate: bulkForm.toDate,
        isExternal: bulkForm.mode === 'external',
      };
      if (bulkForm.mode === 'internal') {
        payload.replacementTrainerId = bulkForm.replacementTrainerId;
      } else {
        payload.externalTrainerName = bulkForm.externalTrainerName.trim();
        payload.externalEmployeeId = bulkForm.externalEmployeeId.trim();
        payload.externalEmail = bulkForm.externalEmail.trim().toLowerCase();
      }
      const data = await assignBulkReplacement(payload);
      if (data?.createdExternalAccount && data?.defaultPassword) {
        showSuccess(`Bulk replacement saved. External trainer account created. Default password: ${data.defaultPassword}`);
      } else {
        showSuccess('Bulk replacement saved');
      }
      setShowBulkModal(false);
      fetchReplacements();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setBulkSubmitting(false);
    }
  };

  const closeSuggestionsModal = () => {
    setSelectedSchedule(null);
    setSelectedLeaveId('');
    setChangingReplacement(false);
    setSuggestions([]);
    setOtherSuggestions([]);
    setSuggestionSubject(null);
    setSuggestionFilter('');
    setExternalTrainerName('');
    setAssigningExternal(false);
  };

  const handleViewSuggestions = async (leaveId, schedule, replacement = null) => {
    setSelectedSchedule(schedule);
    setSelectedLeaveId(leaveId);
    setChangingReplacement(Boolean(replacement));
    setExternalTrainerName(replacement?.isExternal ? (replacement.name || '') : '');
    setLoadingSuggestions(true);
    setSuggestions([]);
    setOtherSuggestions([]);
    setSuggestionSubject(null);
    setSuggestionFilter('');
    try {
      const data = await getReplacementSuggestions(schedule._id, leaveId);
      setSuggestions(data.suggestions || []);
      setOtherSuggestions(data.otherSuggestions || []);
      setSuggestionSubject(data.subject || null);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAssign = async (trainerId) => {
    try {
      await assignReplacement(selectedLeaveId, selectedSchedule._id, {
        replacementTrainerId: trainerId,
      });
      showSuccess(changingReplacement ? 'Replacement trainer updated' : 'Replacement trainer assigned');
      closeSuggestionsModal();
      fetchReplacements();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  const handleAssignExternal = async () => {
    const name = externalTrainerName.trim();
    if (!name) {
      showError('Enter the external trainer name');
      return;
    }
    setAssigningExternal(true);
    try {
      await assignReplacement(selectedLeaveId, selectedSchedule._id, {
        isExternal: true,
        externalTrainerName: name,
      });
      showSuccess(changingReplacement ? 'Replacement updated to external trainer' : 'External trainer assigned');
      closeSuggestionsModal();
      fetchReplacements();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setAssigningExternal(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!pendingCancel) return;
    try {
      await cancelReplacement(pendingCancel.leaveId, pendingCancel.scheduleId);
      showSuccess('Replacement cancelled. Original trainer will handle this class.');
      setPendingCancel(null);
      fetchReplacements();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  const renderSuggestionRows = (items, { startIndex = 0, showWarning = false } = {}) =>
    items.map((s, i) => (
      <tr key={s.trainer._id} className={showWarning ? 'table-warning' : undefined}>
        <td>{startIndex + i + 1}</td>
        <td>
          <div>{s.trainer.name} <small className="text-muted">({s.trainer.employeeId})</small></div>
          {showWarning && (
            <small className="text-warning-emphasis">
              Not eligible for {suggestionSubject?.name || 'this subject'}
            </small>
          )}
        </td>
        <td>{s.weeklyHours.toFixed(1)} hrs</td>
        <td>{s.performanceScore}%</td>
        <td>
          <button type="button" className="btn btn-sm btn-success" onClick={() => handleAssign(s.trainer._id)}>
            {changingReplacement ? 'Update' : 'Assign'}
          </button>
        </td>
      </tr>
    ));

  const hasAnySuggestions = suggestions.length > 0 || otherSuggestions.length > 0;
  const suggestionQuery = suggestionFilter.trim().toLowerCase();
  const matchesSuggestion = (item) => {
    if (!suggestionQuery) return true;
    const name = String(item.trainer?.name || '').toLowerCase();
    const employeeId = String(item.trainer?.employeeId || '').toLowerCase();
    return name.includes(suggestionQuery) || employeeId.includes(suggestionQuery);
  };
  const visibleSuggestions = suggestions.filter(matchesSuggestion);
  const visibleOtherSuggestions = otherSuggestions.filter(matchesSuggestion);
  const hasVisibleSuggestions = visibleSuggestions.length > 0 || visibleOtherSuggestions.length > 0;

  const formatReplacementDate = (leave, schedule, affectedDates = [], bulkRangeStart = null, bulkRangeEnd = null, isBulkMerged = false) => {
    if (isBulkMerged && bulkRangeStart && bulkRangeEnd) {
      return `${formatDate(bulkRangeStart)} – ${formatDate(bulkRangeEnd)}`;
    }
    if (affectedDates.length) {
      return affectedDates.map((date) => formatDate(date)).join(', ');
    }
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (start.getTime() === end.getTime()) {
      return formatDate(leave.startDate);
    }
    return `${formatDate(leave.startDate)} – ${formatDate(leave.endDate)} (${schedule.day})`;
  };

  return (
    <>
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Replacements
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'availability' ? 'active' : ''}`}
            onClick={() => setActiveTab('availability')}
          >
            Trainer Availability
          </button>
        </li>
      </ul>

      {activeTab === 'availability' ? (
        <TrainerAvailabilityPanel />
      ) : loading ? <LoadingSpinner /> : (
        <div className="card table-card">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <h5 className="card-title mb-0">Replacement Register</h5>
              <div className="d-flex align-items-center gap-2">
                <div className="btn-group btn-group-sm" role="group" aria-label="Replacement register filter">
                  <button
                    type="button"
                    className={`btn ${registerFilter === 'all' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                    onClick={() => {
                      setRegisterFilter('all');
                      setPage(1);
                    }}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`btn ${registerFilter === 'pending' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                    onClick={() => {
                      setRegisterFilter('pending');
                      setPage(1);
                    }}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    className={`btn ${registerFilter === 'closed' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                    onClick={() => {
                      setRegisterFilter('closed');
                      setPage(1);
                    }}
                  >
                    Closed
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={openBulkModal}
                >
                  Bulk Replacement
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddSlotModal(true)}
                >
                  Add Replacement
                </button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Trainer on Leave</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Venue</th>
                    <th>Status</th>
                    <th>Replacement</th>
                  </tr>
                </thead>
                <tbody>
                  {replacements.length === 0 ? (
                    <tr><td colSpan="8" className="text-center text-muted py-4">No replacement records found</td></tr>
                  ) : replacements.map(({
                    leave,
                    schedule,
                    replacement,
                    timelineStatus,
                    canAssign,
                    canChange,
                    affectedDates,
                    isBulkMerged,
                    bulkRangeStart,
                    bulkRangeEnd,
                  }) => (
                    <tr key={`${leave._id}-${schedule._id}`}>
                      <td>{leave.trainer?.name}</td>
                      <td>{formatReplacementDate(leave, schedule, affectedDates, bulkRangeStart, bulkRangeEnd, isBulkMerged)}</td>
                      <td>{isBulkMerged ? 'All' : formatTimeRange(schedule.startTime, schedule.endTime)}</td>
                      <td>{isBulkMerged ? 'All' : `${schedule.department} ${schedule.section}`}</td>
                      <td>{isBulkMerged ? 'All' : (schedule.subject?.name || schedule.subjectCode || '—')}</td>
                      <td>
                        {isBulkMerged
                          ? 'All'
                          : (schedule.venue?.name
                          || [schedule.venue?.building, schedule.venue?.floor].filter(Boolean).join(' ')
                          || '—')}
                      </td>
                      <td>
                        <span className={`badge ${REPLACEMENT_STATUS[timelineStatus]?.className || 'bg-secondary'}`}>
                          {REPLACEMENT_STATUS[timelineStatus]?.label || timelineStatus}
                        </span>
                      </td>
                      <td>
                        {replacement ? (
                          <div className="d-flex align-items-center gap-2">
                            <span className="small">
                              <strong>{replacement.name}</strong>
                              {replacement.isExternal && (
                                <span className="badge bg-secondary ms-1">External</span>
                              )}
                            </span>
                            {canChange && (
                              <>
                                <ActionIconButton
                                  variant="edit"
                                  icon={EditIcon}
                                  title="Change replacement"
                                  aria-label={`Change replacement for ${schedule.department} ${schedule.section}`}
                                  onClick={() => handleViewSuggestions(leave._id, schedule, replacement)}
                                />
                                <ActionIconButton
                                  variant="delete"
                                  icon={TrashIcon}
                                  title="Cancel replacement"
                                  aria-label={`Cancel replacement for ${schedule.department} ${schedule.section}`}
                                  onClick={() => setPendingCancel({
                                    leaveId: leave._id,
                                    scheduleId: schedule._id,
                                    originalTrainerName: leave.trainer?.name,
                                    replacementName: replacement.name,
                                    classLabel: `${schedule.department} ${schedule.section}`,
                                  })}
                                />
                              </>
                            )}
                          </div>
                        ) : canAssign ? (
                          <div className="d-flex align-items-center gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => handleViewSuggestions(leave._id, schedule)}
                            >
                              Find Replacements
                            </button>
                            <ActionIconButton
                              variant="delete"
                              icon={TrashIcon}
                              title="Cancel replacement"
                              aria-label={`Cancel replacement for ${schedule.department} ${schedule.section}`}
                              onClick={() => setPendingCancel({
                                leaveId: leave._id,
                                scheduleId: schedule._id,
                                originalTrainerName: leave.trainer?.name,
                                replacementName: null,
                                classLabel: `${schedule.department} ${schedule.section}`,
                              })}
                            />
                          </div>
                        ) : (
                          <span className="text-muted small">
                            {timelineStatus === 'pending_approval' ? 'Awaiting approval' : 'Not assigned'}
                          </span>
                        )}
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
                align="between"
              />
          </div>
        </div>
      )}

      <AddSlotReplacementModal
        show={activeTab === 'all' && showAddSlotModal}
        onClose={() => setShowAddSlotModal(false)}
        onCreated={fetchReplacements}
      />

      {activeTab === 'all' && showBulkModal && (
        <Modal show title="Bulk Replacement" onClose={() => setShowBulkModal(false)} size="toms-modal-lg">
          <div className="toms-modal-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Trainer on leave</label>
                <select
                  className="form-select"
                  value={bulkForm.sourceTrainerId}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, sourceTrainerId: e.target.value }))}
                >
                  <option value="">Select trainer</option>
                  {bulkTrainerOptions.map((trainer) => (
                    <option key={trainer._id} value={trainer._id}>
                      {trainer.name} ({trainer.employeeId})
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">From date</label>
                <input
                  type="date"
                  className="form-control"
                  value={bulkForm.fromDate}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, fromDate: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">To date</label>
                <input
                  type="date"
                  className="form-control"
                  value={bulkForm.toDate}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, toDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={loadBulkSuggestions}
                disabled={loadingBulkSuggestions}
              >
                {loadingBulkSuggestions ? 'Loading...' : 'Load suggestions'}
              </button>
              {bulkTargetCount > 0 && (
                <span className="small text-muted">
                  {bulkTargetCount} class slots need replacement in this range
                </span>
              )}
            </div>

            <div className="mt-3">
              <div className="form-check form-check-inline">
                <input
                  className="form-check-input"
                  type="radio"
                  name="bulk-mode"
                  id="bulk-mode-internal"
                  checked={bulkForm.mode === 'internal'}
                  onChange={() => setBulkForm((prev) => ({ ...prev, mode: 'internal' }))}
                />
                <label className="form-check-label" htmlFor="bulk-mode-internal">
                  Existing trainer
                </label>
              </div>
              <div className="form-check form-check-inline">
                <input
                  className="form-check-input"
                  type="radio"
                  name="bulk-mode"
                  id="bulk-mode-external"
                  checked={bulkForm.mode === 'external'}
                  onChange={() => setBulkForm((prev) => ({ ...prev, mode: 'external' }))}
                />
                <label className="form-check-label" htmlFor="bulk-mode-external">
                  External trainer (create account)
                </label>
              </div>
            </div>

            {bulkForm.mode === 'internal' ? (
              <div className="mt-3">
                <label className="form-label">Suggested trainers</label>
                <select
                  className="form-select"
                  value={bulkForm.replacementTrainerId}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, replacementTrainerId: e.target.value }))}
                >
                  <option value="">Select replacement trainer</option>
                  {bulkSuggestions.map((item) => (
                    <option key={item.trainer._id} value={item.trainer._id}>
                      {item.trainer.name} ({item.trainer.employeeId}) · {item.weeklyHours.toFixed(1)} hrs
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="row g-3 mt-1">
                <div className="col-md-4">
                  <label className="form-label">External trainer name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={bulkForm.externalTrainerName}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, externalTrainerName: e.target.value }))}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Employee ID</label>
                  <input
                    type="text"
                    className="form-control"
                    value={bulkForm.externalEmployeeId}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, externalEmployeeId: e.target.value }))}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={bulkForm.externalEmail}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, externalEmail: e.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <div className="small text-muted">
                    A trainer account is created with role trainer and default password Mbu#2026.
                    CAMU credentials are copied from the original trainer.
                  </div>
                </div>
              </div>
            )}

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setShowBulkModal(false)}
                disabled={bulkSubmitting}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBulkAssign}
                disabled={bulkSubmitting}
              >
                {bulkSubmitting ? 'Saving...' : 'Apply Bulk Replacement'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {pendingCancel && (
        <ConfirmModal
          show
          title="Cancel Replacement"
          message={
            pendingCancel.replacementName
              ? `Cancel replacement by "${pendingCancel.replacementName}" for ${pendingCancel.classLabel}? ${pendingCancel.originalTrainerName || 'The original trainer'} will handle this class as originally allocated.`
              : `Cancel replacement requirement for ${pendingCancel.classLabel}? ${pendingCancel.originalTrainerName || 'The original trainer'} will handle this class as originally allocated.`
          }
          confirmLabel="Cancel replacement"
          confirmVariant="danger"
          onConfirm={handleConfirmCancel}
          onClose={() => setPendingCancel(null)}
        />
      )}

      {activeTab === 'all' && selectedSchedule && (
        <Modal
          show
          title={changingReplacement ? 'Change Replacement Trainer' : 'Available Replacement Trainers'}
          onClose={closeSuggestionsModal}
          size="toms-modal-lg"
        >
          <div className="toms-modal-body">
            <p className="text-muted">
              {selectedSchedule.department} {selectedSchedule.section} on {selectedSchedule.day} at {formatTimeRange(selectedSchedule.startTime, selectedSchedule.endTime)}
            </p>
            {loadingSuggestions ? <LoadingSpinner message="Finding replacements..." /> : (
              <div className="table-responsive">
                {hasAnySuggestions && (
                  <div className="mb-3">
                    <label className="form-label small mb-1" htmlFor="replacement-suggestion-filter">
                      Search available trainers
                    </label>
                    <input
                      id="replacement-suggestion-filter"
                      type="search"
                      className="form-control form-control-sm"
                      placeholder="Search by name or employee ID"
                      value={suggestionFilter}
                      onChange={(e) => setSuggestionFilter(e.target.value)}
                    />
                  </div>
                )}
                {suggestions.length === 0 && otherSuggestions.length > 0 && (
                  <div className="alert alert-warning small py-2 mb-3" role="status">
                    No subject-eligible trainers are available for this slot. Other available trainers are listed below.
                  </div>
                )}
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Trainer</th>
                      <th>Weekly Hours</th>
                      <th>Performance</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!hasAnySuggestions ? (
                      <tr><td colSpan="5" className="text-center text-muted">No available trainers found</td></tr>
                    ) : !hasVisibleSuggestions ? (
                      <tr><td colSpan="5" className="text-center text-muted">No trainers match this search</td></tr>
                    ) : (
                      <>
                        {renderSuggestionRows(visibleSuggestions)}
                        {visibleOtherSuggestions.length > 0 && visibleSuggestions.length > 0 && (
                          <tr className="table-light">
                            <td colSpan="5" className="small text-muted py-2">
                              Other available trainers (not subject-eligible)
                            </td>
                          </tr>
                        )}
                        {renderSuggestionRows(visibleOtherSuggestions, {
                          startIndex: visibleSuggestions.length,
                          showWarning: true,
                        })}
                      </>
                    )}
                  </tbody>
                </table>

                <div className="border-top pt-3 mt-3">
                  <p className="small text-muted mb-2">
                    No campus trainer available? Assign an external trainer. Hours are not tracked for external trainers.
                  </p>
                  <div className="row g-2 align-items-end">
                    <div className="col-sm">
                      <label className="form-label small mb-1" htmlFor="external-trainer-name">
                        External trainer name
                      </label>
                      <input
                        id="external-trainer-name"
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Enter external trainer name"
                        value={externalTrainerName}
                        onChange={(e) => setExternalTrainerName(e.target.value)}
                        disabled={assigningExternal}
                      />
                    </div>
                    <div className="col-sm-auto">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={handleAssignExternal}
                        disabled={assigningExternal || !externalTrainerName.trim()}
                      >
                        {assigningExternal
                          ? 'Assigning...'
                          : changingReplacement
                            ? 'Update to External'
                            : 'Assign External'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

export default Replacements;
