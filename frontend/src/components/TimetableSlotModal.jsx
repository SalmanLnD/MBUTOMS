import { useState, useEffect } from 'react';
import Modal from './Modal.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { createSchedule, updateSchedule, deleteSchedule } from '../services/scheduleService.js';
import { getClasses } from '../services/classService.js';
import { getSlotTimesForSubject, getActiveSlotKeys } from '../utils/timetableSlots.js';
import { getErrorMessage } from '../utils/helpers.js';

const emptyForm = {
  subjectId: '',
  classId: '',
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
  semester = 'III',
  onClose,
}) => {
  const isEdit = Boolean(schedule);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(false);
  const [classOptions, setClassOptions] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);

  const selectedSubject = subjects.find((item) => item._id === form.subjectId) || subject;
  const selectedClass = classOptions.find((item) => item._id === form.classId);

  useEffect(() => {
    setClassesLoading(true);
    getClasses({ semester })
      .then((data) => setClassOptions(data || []))
      .catch(() => setClassOptions([]))
      .finally(() => setClassesLoading(false));
  }, [semester]);

  useEffect(() => {
    const initialSubjectId = schedule?.subject || subject?._id || '';
    const initialSlot = schedule?.slot || slot || 'S1';
    const subjectForTimes = subjects.find((item) => item._id === initialSubjectId) || subject;
    const times = getSlotTimesForSubject(subjectForTimes, initialSlot);
    const matchedClass = classOptions.find(
      (item) =>
        item.department === schedule?.department
        && item.section === schedule?.section
        && item.currentSemester === (schedule?.semester || semester)
    );

    setForm({
      subjectId: initialSubjectId,
      classId: matchedClass?._id || '',
      slot: initialSlot,
      day: schedule?.day || day || 'Monday',
      department: schedule?.department || matchedClass?.department || '',
      section: schedule?.section || matchedClass?.section || '',
      startTime: schedule?.startTime || times.startTime,
      endTime: schedule?.endTime || times.endTime,
      semester: schedule?.semester || matchedClass?.currentSemester || semester,
    });
  }, [schedule, trainerCode, day, slot, subject, subjects, semester, classOptions]);

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
    if (name === 'classId') {
      const cls = classOptions.find((item) => item._id === value);
      setForm((prev) => ({
        ...prev,
        classId: value,
        department: cls?.department || '',
        section: cls?.section || '',
        semester: cls?.currentSemester || prev.semester,
      }));
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
      classId: form.classId || undefined,
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
                  {getActiveSlotKeys(selectedSubject).map((slotKey) => {
                    const times = getSlotTimesForSubject(selectedSubject, slotKey);
                    return (
                      <option key={slotKey} value={slotKey}>
                        {slotKey} ({times.startTime} – {times.endTime})
                      </option>
                    );
                  })}
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
              <div className="col-12">
                <label className="form-label" htmlFor="slot-class">Class *</label>
                {classesLoading ? (
                  <div className="text-muted small">Loading registered classes...</div>
                ) : (
                  <select
                    id="slot-class"
                    name="classId"
                    className="form-select"
                    value={form.classId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select a registered class</option>
                    {classOptions.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.department} {item.section} · PY {item.py} · Sem {item.currentSemester}
                      </option>
                    ))}
                  </select>
                )}
                {!classesLoading && classOptions.length === 0 && (
                  <small className="text-muted d-block mt-1">
                    No classes registered for semester {semester}. Add classes under Classes &amp; Students first.
                  </small>
                )}
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
