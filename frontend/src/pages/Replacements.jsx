import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import AlertMessage from '../components/AlertMessage.jsx';
import {
  getPendingReplacements,
  getReplacementSuggestions,
  assignReplacement,
} from '../services/replacementService.js';
import { getErrorMessage } from '../utils/helpers.js';
import { formatTimeRange } from '../utils/scheduleUtils.js';
import Modal from '../components/Modal.jsx';
import { EditIcon } from '../components/icons.jsx';

const Replacements = () => {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [changingReplacement, setChangingReplacement] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const data = await getPendingReplacements();
      setPending(data.pending || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const closeSuggestionsModal = () => {
    setSelectedSchedule(null);
    setChangingReplacement(false);
    setSuggestions([]);
  };

  const handleViewSuggestions = async (schedule, replacement = null) => {
    setSelectedSchedule(schedule);
    setChangingReplacement(Boolean(replacement));
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const data = await getReplacementSuggestions(schedule._id);
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAssign = async (trainerId) => {
    try {
      await assignReplacement(selectedSchedule._id, trainerId);
      setSuccess(changingReplacement ? 'Replacement trainer updated' : 'Replacement trainer assigned');
      closeSuggestionsModal();
      fetchPending();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <Topbar title="Replacement Suggestions" />
      <AlertMessage message={error} onClose={() => setError('')} />
      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />

      {loading ? <LoadingSpinner /> : (
        <div className="card table-card">
          <div className="card-body">
            <h5 className="card-title mb-3">Classes Needing Replacement</h5>
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
                      <td>{schedule.day}</td>
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
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center"
                              style={{ width: '2rem', height: '2rem', padding: 0 }}
                              aria-label={`Change replacement for ${schedule.department} ${schedule.section}`}
                              title="Change replacement"
                              onClick={() => handleViewSuggestions(schedule, replacement)}
                            >
                              <EditIcon size={16} />
                            </button>
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

      {selectedSchedule && (
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
                    {suggestions.length === 0 ? (
                      <tr><td colSpan="5" className="text-center text-muted">No eligible trainers found</td></tr>
                    ) : suggestions.map((s, i) => (
                      <tr key={s.trainer._id}>
                        <td>{i + 1}</td>
                        <td>{s.trainer.name} <small className="text-muted">({s.trainer.employeeId})</small></td>
                        <td>{s.weeklyHours.toFixed(1)} hrs</td>
                        <td>{s.performanceScore}%</td>
                        <td>
                          <button type="button" className="btn btn-sm btn-success" onClick={() => handleAssign(s.trainer._id)}>
                            {changingReplacement ? 'Update' : 'Assign'}
                          </button>
                        </td>
                      </tr>
                    ))}
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
