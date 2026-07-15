import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import {
  getAllReplacements,
  getReplacementSuggestions,
  assignReplacement,
} from '../services/replacementService.js';
import { formatDate, getErrorMessage } from '../utils/helpers.js';
import { formatTimeRange } from '../utils/scheduleUtils.js';
import Modal from '../components/Modal.jsx';
import TrainerAvailabilityPanel from '../components/TrainerAvailabilityPanel.jsx';
import AddSlotReplacementModal from '../components/AddSlotReplacementModal.jsx';
import { EditIcon } from '../components/icons.jsx';
import ActionIconButton from '../components/ActionIconButton.jsx';
import Pagination from '../components/Pagination.jsx';
import { usePagination } from '../hooks/usePagination.js';

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

  const fetchReplacements = async () => {
    setLoading(true);
    try {
      const data = await getAllReplacements({ page, limit: pageSize });
      setReplacements(data.replacements || []);
      setPagination(data.pagination || null);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReplacements(); }, [page, pageSize]);

  const closeSuggestionsModal = () => {
    setSelectedSchedule(null);
    setSelectedLeaveId('');
    setChangingReplacement(false);
    setSuggestions([]);
    setOtherSuggestions([]);
    setSuggestionSubject(null);
    setSuggestionFilter('');
  };

  const handleViewSuggestions = async (leaveId, schedule, replacement = null) => {
    setSelectedSchedule(schedule);
    setSelectedLeaveId(leaveId);
    setChangingReplacement(Boolean(replacement));
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
      await assignReplacement(selectedLeaveId, selectedSchedule._id, trainerId);
      showSuccess(changingReplacement ? 'Replacement trainer updated' : 'Replacement trainer assigned');
      closeSuggestionsModal();
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

  const formatReplacementDate = (leave, schedule, affectedDates = []) => {
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
      <Topbar title="Replacements" />

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
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="card-title mb-0">Replacement Register</h5>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddSlotModal(true)}
              >
                Add Replacement
              </button>
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
                    affectedDates,
                  }) => (
                    <tr key={`${leave._id}-${schedule._id}`}>
                      <td>{leave.trainer?.name}</td>
                      <td>{formatReplacementDate(leave, schedule, affectedDates)}</td>
                      <td>{formatTimeRange(schedule.startTime, schedule.endTime)}</td>
                      <td>{schedule.department} {schedule.section}</td>
                      <td>{schedule.subject?.name || schedule.subjectCode || '—'}</td>
                      <td>
                        {schedule.venue?.name
                          || [schedule.venue?.building, schedule.venue?.floor].filter(Boolean).join(' ')
                          || '—'}
                      </td>
                      <td>
                        <span className={`badge ${REPLACEMENT_STATUS[timelineStatus]?.className || 'bg-secondary'}`}>
                          {REPLACEMENT_STATUS[timelineStatus]?.label || timelineStatus}
                        </span>
                      </td>
                      <td>
                        {replacement ? (
                          <div className="d-flex align-items-center gap-2">
                            <span className="small"><strong>{replacement.name}</strong></span>
                            {canAssign && (
                              <ActionIconButton
                                variant="edit"
                                icon={EditIcon}
                                title="Change replacement"
                                aria-label={`Change replacement for ${schedule.department} ${schedule.section}`}
                                onClick={() => handleViewSuggestions(leave._id, schedule, replacement)}
                              />
                            )}
                          </div>
                        ) : canAssign ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => handleViewSuggestions(leave._id, schedule)}
                          >
                            Find Replacements
                          </button>
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
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

export default Replacements;
