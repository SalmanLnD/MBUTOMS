import { useState, useEffect } from 'react';
import Modal from './Modal.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { createSchedule, updateSchedule, deleteSchedule } from '../services/scheduleService.js';
import { getSlotTimesForSubject } from '../utils/timetableSlots.js';
import { getErrorMessage } from '../utils/helpers.js';

const emptyForm = {
  subjectId: '',
  slot: 'S1',
  day: 'Monday',
  department: '',
  section: '',
  startTime: '09:00',
  endTime: '10:50',
  semester: 'III',
};

const TimetableSlotModal = ({
  schedule,
  trainerCode,
  day,
  slot,
  subject,
  subjects,
  onClose,
}) => {
  const isEdit = Boolean(schedule);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(false);

  const selectedSubject = subjects.find((item) => item._id === form.subjectId) || subject;

  useEffect(() => {
    const initialSubjectId = schedule?.subject || subject?._id || '';
    const initialSlot = schedule?.slot || slot || 'S1';
    const subjectForTimes = subjects.find((item) => item._id === initialSubjectId) || subject;
    const times = getSlotTimesForSubject(subjectForTimes, initialSlot);

    setForm({
      subjectId: initialSubjectId,
      slot: initialSlot,
      day: schedule?.day || day || 'Monday',
      department: schedule?.department || '',
      section: schedule?.section || '',
      startTime: schedule?.startTime || times.startTime,
      endTime: schedule?.endTime || times.endTime,
      semester: schedule?.semester || 'III',
    });
  }, [schedule, trainerCode, day, slot, subject, subjects]);

  const applySlotTimes = (subjectId, slotKey) => {
    const subjectItem = subjects.find((item) => item._id === subjectId) || subject;
    const times = getSlotTimesForSubject(subjectItem, slotKey);
    setForm((prev) => ({
      ...prev,
      subjectId,
      slot: slotKey,
      startTime: times.startTime,
      endTime: times.endTime,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'subjectId') {
      applySlotTimes(value, form.slot);
      return;
    }
    if (name === 'slot') {
      applySlotTimes(form.subjectId, value);
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      trainerCode,
      day: form.day,
      slot: form.slot,
      startTime: form.startTime,
      endTime: form.endTime,
      department: form.department.trim(),
      section: form.section.trim(),
      subjectCode: selectedSubject?.code || '',
      subject: form.subjectId || undefined,
      semester: form.semester,
    };

    try {
      if (isEdit) {
        await updateSchedule(schedule._id, payload);
      } else {
        await createSchedule(payload);
      }
      onClose(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setLoading(true);
    setError('');
    try {
      await deleteSchedule(schedule._id);
      setPendingDelete(false);
      onClose(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        show
        title={isEdit ? 'Edit Timetable Slot' : 'Add Timetable Slot'}
        onClose={() => onClose(false)}
        size="toms-modal-lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="toms-modal-body">
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="slot-subject">Subject *</label>
                <select
                  id="slot-subject"
                  name="subjectId"
                  className="form-select"
                  value={form.subjectId}
                  onChange={handleChange}
                  required
                  disabled={Boolean(subject) && !isEdit}
                >
                  <option value="">Select subject</option>
                  {subjects.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name} ({item.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="slot-period">Period *</label>
                <select
                  id="slot-period"
                  name="slot"
                  className="form-select"
                  value={form.slot}
                  onChange={handleChange}
                  required
                >
                  <option value="S1">S1 ({getSlotTimesForSubject(selectedSubject, 'S1').startTime} – {getSlotTimesForSubject(selectedSubject, 'S1').endTime})</option>
                  <option value="S2">S2 ({getSlotTimesForSubject(selectedSubject, 'S2').startTime} – {getSlotTimesForSubject(selectedSubject, 'S2').endTime})</option>
                  <option value="S3">S3 ({getSlotTimesForSubject(selectedSubject, 'S3').startTime} – {getSlotTimesForSubject(selectedSubject, 'S3').endTime})</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="slot-day">Day *</label>
                <select
                  id="slot-day"
                  name="day"
                  className="form-select"
                  value={form.day}
                  onChange={handleChange}
                  required
                >
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((weekday) => (
                    <option key={weekday} value={weekday}>{weekday}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Start time</label>
                <input className="form-control" value={form.startTime} readOnly />
              </div>
              <div className="col-md-4">
                <label className="form-label">End time</label>
                <input className="form-control" value={form.endTime} readOnly />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="slot-department">Department *</label>
                <input
                  id="slot-department"
                  name="department"
                  className="form-control"
                  value={form.department}
                  onChange={handleChange}
                  required
                  placeholder="e.g. CS"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="slot-section">Section *</label>
                <input
                  id="slot-section"
                  name="section"
                  className="form-control"
                  value={form.section}
                  onChange={handleChange}
                  required
                  placeholder="e.g. A"
                />
              </div>
            </div>
          </div>
          <div className="toms-modal-footer d-flex justify-content-between">
            <div>
              {isEdit && (
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={() => setPendingDelete(true)}
                  disabled={loading}
                >
                  Delete
                </button>
              )}
            </div>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : isEdit ? 'Update' : 'Add Slot'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {pendingDelete && (
        <ConfirmModal
          show
          title="Delete Timetable Slot"
          message={`Remove ${form.department} ${form.section} on ${form.day} (${form.slot})?`}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingDelete(false)}
        />
      )}
    </>
  );
};

export default TimetableSlotModal;
