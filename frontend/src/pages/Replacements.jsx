import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import {
  getPendingReplacements,
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

const Replacements = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [changingReplacement, setChangingReplacement] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [otherSuggestions, setOtherSuggestions] = useState([]);
  const [suggestionSubject, setSuggestionSubject] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const data = await getPendingReplacements();
      setPending(data.pending || []);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const closeSuggestionsModal = () => {
    setSelectedSchedule(null);
    setChangingReplacement(false);
    setSuggestions([]);
    setOtherSuggestions([]);
    setSuggestionSubject(null);
  };

  const handleViewSuggestions = async (schedule, replacement = null) => {
    setSelectedSchedule(schedule);
    setChangingReplacement(Boolean(replacement));
    setLoadingSuggestions(true);
    setSuggestions([]);
    setOtherSuggestions([]);
    setSuggestionSubject(null);
    try {
      const data = await getReplacementSuggestions(schedule._id);
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
      await assignReplacement(selectedSchedule._id, trainerId);
      showSuccess(changingReplacement ? 'Replacement trainer updated' : 'Replacement trainer assigned');
      closeSuggestionsModal();
      fetchPending();
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

  const formatPendingDate = (leave, schedule) => {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (start.getTime() === end.getTime()) {
      return formatDate(leave.startDate);
    }
    return schedule.day;
  };

  return (
    <>
      <Topbar title="Replacement Suggestions" />

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending Replacements
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
              <h5 className="card-title mb-0">Classes Needing Replacement</h5>
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
                    <th>Subject</th>
                    <th>Venue</th>
                    <th>Batch</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.length === 0 ? (
                    <tr><td colSpan="7" className="text-center text-muted py-4">No pending replacements</td></tr>
                  ) : pending.map(({ leave, schedule, replacement }) => (
                    <tr key={`${leave._id}-${schedule._id}`}>
                      <td>{leave.trainer?.name}</td>
                      <td>{formatPendingDate(leave, schedule)}</td>
                      <td>{formatTimeRange(schedule.startTime, schedule.endTime)}</td>
                      <td>{schedule.department} {schedule.section}</td>
                      <td>—</td>
                      <td>{schedule.department} {schedule.section}</td>
                      <td>
                        {replacement ? (
                          <div className="d-flex align-items-center gap-2">
                            <span className="small text-success">
                              Replaced by <strong>{replacement.name}</strong>
                            </span>
                            <ActionIconButton
                              variant="edit"
                              icon={EditIcon}
                              title="Change replacement"
                              aria-label={`Change replacement for ${schedule.department} ${schedule.section}`}
                              onClick={() => handleViewSuggestions(schedule, replacement)}
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => handleViewSuggestions(schedule)}
                          >
                            Find Replacements
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <AddSlotReplacementModal
        show={activeTab === 'pending' && showAddSlotModal}
        onClose={() => setShowAddSlotModal(false)}
        onCreated={fetchPending}
      />

      {activeTab === 'pending' && selectedSchedule && (
        <Modal
          show
          title={changingReplacement ? 'Change Replacement Trainer' : 'Top 5 Replacement Trainers'}
          onClose={closeSuggestionsModal}
          size="toms-modal-lg"
        >
          <div className="toms-modal-body">
            <p className="text-muted">
              {selectedSchedule.department} {selectedSchedule.section} on {selectedSchedule.day} at {formatTimeRange(selectedSchedule.startTime, selectedSchedule.endTime)}
            </p>
            {loadingSuggestions ? <LoadingSpinner message="Finding replacements..." /> : (
              <div className="table-responsive">
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
                    ) : (
                      <>
                        {renderSuggestionRows(suggestions)}
                        {otherSuggestions.length > 0 && suggestions.length > 0 && (
                          <tr className="table-light">
                            <td colSpan="5" className="small text-muted py-2">
                              Other available trainers (not subject-eligible)
                            </td>
                          </tr>
                        )}
                        {renderSuggestionRows(otherSuggestions, {
                          startIndex: suggestions.length,
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
