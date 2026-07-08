import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import { getTrainers } from '../services/trainerService.js';
import {
  createSlotReplacementRequest,
  getTrainerSlotsForReplacement,
} from '../services/replacementService.js';
import { showError, showSuccess } from '../utils/toast.js';
import { formatDate, getErrorMessage, toInputDate } from '../utils/helpers.js';
import { formatScheduleClassLabel, formatTimeRange } from '../utils/scheduleUtils.js';

const formatSlotLabel = (schedule) => {
  const batch = formatScheduleClassLabel(schedule);
  const subject = schedule.subjectCode ? ` · ${schedule.subjectCode}` : '';
  return `${formatTimeRange(schedule.startTime, schedule.endTime)} — ${batch}${subject}`;
};

const AddSlotReplacementModal = ({ show, onClose, onCreated }) => {
  const [trainers, setTrainers] = useState([]);
  const [loadingTrainers, setLoadingTrainers] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [slots, setSlots] = useState([]);
  const [slotDay, setSlotDay] = useState('');
  const [form, setForm] = useState({
    trainer: '',
    date: toInputDate(new Date()),
    scheduleId: '',
    reason: '',
  });

  useEffect(() => {
    if (!show) return;
    setLoadingTrainers(true);
    getTrainers({ limit: 200, sortBy: 'name', sortOrder: 'asc' })
      .then((data) => setTrainers(data.trainers || []))
      .catch((err) => showError(getErrorMessage(err)))
      .finally(() => setLoadingTrainers(false));
  }, [show]);

  useEffect(() => {
    if (!show) return;
    setForm({
      trainer: '',
      date: toInputDate(new Date()),
      scheduleId: '',
      reason: '',
    });
    setSlots([]);
    setSlotDay('');
  }, [show]);

  useEffect(() => {
    if (!show || !form.trainer || !form.date) {
      setSlots([]);
      setSlotDay('');
      return;
    }

    const loadSlots = async () => {
      setLoadingSlots(true);
      setForm((current) => ({ ...current, scheduleId: '' }));
      try {
        const data = await getTrainerSlotsForReplacement({
          trainerId: form.trainer,
          date: form.date,
        });
        setSlots(data.schedules || []);
        setSlotDay(data.day || '');
      } catch (err) {
        showError(getErrorMessage(err));
        setSlots([]);
        setSlotDay('');
      } finally {
        setLoadingSlots(false);
      }
    };

    loadSlots();
  }, [show, form.trainer, form.date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.trainer || !form.scheduleId || !form.date) return;

    setSubmitting(true);
    try {
      await createSlotReplacementRequest({
        trainerId: form.trainer,
        scheduleId: form.scheduleId,
        date: form.date,
        reason: form.reason.trim() || undefined,
      });
      showSuccess('Slot replacement request added');
      onCreated?.();
      onClose();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} title="Add Slot Replacement" onClose={onClose} size="toms-modal-lg">
      <form onSubmit={handleSubmit}>
        <div className="toms-modal-body">
          <p className="text-muted small">
            Use this when a trainer needs cover for a single class, without applying leave for the full day.
          </p>

          {loadingTrainers ? (
            <LoadingSpinner message="Loading trainers..." />
          ) : (
            <>
              <div className="mb-3">
                <label className="form-label" htmlFor="slot-replacement-trainer">Trainer</label>
                <select
                  id="slot-replacement-trainer"
                  className="form-select"
                  value={form.trainer}
                  onChange={(e) => setForm({ ...form, trainer: e.target.value, scheduleId: '' })}
                  required
                >
                  <option value="">Select trainer</option>
                  {trainers.map((trainer) => (
                    <option key={trainer._id} value={trainer._id}>
                      {trainer.name} ({trainer.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="slot-replacement-date">Date</label>
                <input
                  id="slot-replacement-date"
                  type="date"
                  className="form-control"
                  value={form.date}
                  min={toInputDate(new Date())}
                  onChange={(e) => setForm({ ...form, date: e.target.value, scheduleId: '' })}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="slot-replacement-slot">Class slot</label>
                {loadingSlots ? (
                  <LoadingSpinner message="Loading class slots..." />
                ) : (
                  <select
                    id="slot-replacement-slot"
                    className="form-select"
                    value={form.scheduleId}
                    onChange={(e) => setForm({ ...form, scheduleId: e.target.value })}
                    required
                    disabled={!form.trainer || !slots.length}
                  >
                    <option value="">
                      {!form.trainer
                        ? 'Select a trainer first'
                        : slots.length
                          ? 'Select class slot'
                          : `No classes on ${slotDay || 'this day'}`}
                    </option>
                    {slots.map((schedule) => (
                      <option key={schedule._id} value={schedule._id}>
                        {formatSlotLabel(schedule)}
                      </option>
                    ))}
                  </select>
                )}
                {form.trainer && form.date && slotDay && !loadingSlots && (
                  <div className="form-text">
                    Showing {slotDay} slots for {formatDate(form.date)}.
                  </div>
                )}
              </div>

              <div className="mb-0">
                <label className="form-label" htmlFor="slot-replacement-reason">Reason (optional)</label>
                <textarea
                  id="slot-replacement-reason"
                  className="form-control"
                  rows="2"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Sick leave for this period only"
                />
              </div>
            </>
          )}
        </div>
        <div className="toms-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || loadingTrainers || !form.scheduleId}
          >
            {submitting ? 'Adding...' : 'Add Replacement'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddSlotReplacementModal;
