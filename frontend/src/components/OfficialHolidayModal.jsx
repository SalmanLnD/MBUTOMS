import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { PlusIcon, TrashIcon } from './icons.jsx';
import ActionIconButton from './ActionIconButton.jsx';
import {
  createOfficialHoliday,
  deleteOfficialHoliday,
  listOfficialHolidays,
} from '../services/attendanceService.js';
import { getErrorMessage } from '../utils/helpers.js';
import {
  formatAttendanceDayLabel,
  TRAINER_ATTENDANCE_TRACKING_START,
} from '../utils/monthDates.js';

const OfficialHolidayModal = ({ show, onClose, onChanged }) => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [name, setName] = useState('Official leave');
  const [pendingDelete, setPendingDelete] = useState(null);

  const loadHolidays = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listOfficialHolidays();
      setHolidays(data.holidays || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    setDate('');
    setName('Official leave');
    loadHolidays();
  }, [show, loadHolidays]);

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!date) {
      setError('Choose a date.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createOfficialHoliday({
        date,
        name: name.trim() || 'Official leave',
      });
      setDate('');
      setName('Official leave');
      await loadHolidays();
      onChanged?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    setError('');
    try {
      await deleteOfficialHoliday(pendingDelete.id);
      setPendingDelete(null);
      await loadHolidays();
      onChanged?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        show={show}
        title="Official holidays"
        onClose={onClose}
        size="toms-modal-lg"
        scrollable
      >
        <div className="toms-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <p className="text-muted small mb-3">
            Adding a holiday marks every employee as Holiday for that date.
          </p>

          <form className="row g-2 align-items-end mb-3" onSubmit={handleAdd}>
            <div className="col-md-4">
              <label className="form-label small text-muted mb-1" htmlFor="official-holiday-date">
                Date
              </label>
              <input
                id="official-holiday-date"
                type="date"
                className="form-control form-control-sm"
                min={TRAINER_ATTENDANCE_TRACKING_START}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="col-md-5">
              <label className="form-label small text-muted mb-1" htmlFor="official-holiday-name">
                Name
              </label>
              <input
                id="official-holiday-name"
                type="text"
                className="form-control form-control-sm"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Official leave"
              />
            </div>
            <div className="col-md-3">
              <button
                type="submit"
                className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
                disabled={saving}
              >
                <PlusIcon size={16} aria-hidden="true" />
                Add holiday
              </button>
            </div>
          </form>

          {loading ? (
            <div className="text-muted">Loading holidays...</div>
          ) : !holidays.length ? (
            <div className="text-muted">No official holidays added yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((holiday) => (
                    <tr key={holiday.id}>
                      <td>{formatAttendanceDayLabel(holiday.date)}</td>
                      <td>{holiday.name}</td>
                      <td className="text-end">
                        <ActionIconButton
                          variant="delete"
                          icon={TrashIcon}
                          title="Remove holiday"
                          aria-label={`Remove holiday ${holiday.name}`}
                          onClick={() => setPendingDelete(holiday)}
                          disabled={saving}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {pendingDelete && (
        <ConfirmModal
          show
          title="Remove holiday"
          message={`Remove "${pendingDelete.name}" on ${formatAttendanceDayLabel(pendingDelete.date)}? Attendance marked Holiday for that date will be cleared.`}
          confirmLabel="Remove"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  );
};

export default OfficialHolidayModal;
