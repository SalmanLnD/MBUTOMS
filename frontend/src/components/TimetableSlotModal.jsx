import { useState, useEffect, useMemo } from 'react';
import Modal from './Modal.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import StyledSelect from './StyledSelect.jsx';
import { createSchedule, updateSchedule, deleteSchedule } from '../services/scheduleService.js';
import { getClasses } from '../services/classService.js';
import { getSlotTimesForSubject, getActiveSlotKeys } from '../utils/timetableSlots.js';
import { getErrorMessage } from '../utils/helpers.js';
import { subjectHasClassRestrictions } from '../utils/subjectClassEligibility.js';
import { getSubjectSemesterRoman } from '../utils/classPy.js';

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
  const subjectIdForClasses = selectedSubject?._id || '';
  const subjectSemesterRoman = getSubjectSemesterRoman(selectedSubject) || semester;

  useEffect(() => {
    setClassesLoading(true);
    const params = { semester: subjectSemesterRoman };
    if (subjectIdForClasses) {
      params.subjectId = subjectIdForClasses;
    }
    getClasses(params)
      .then((data) => setClassOptions(data || []))
      .catch(() => setClassOptions([]))
      .finally(() => setClassesLoading(false));
  }, [subjectSemesterRoman, subjectIdForClasses]);

  const visibleClassOptions = useMemo(() => {
    if (!isEdit || !schedule?.department || !schedule?.section) {
      return classOptions;
    }

    const alreadyListed = classOptions.some(
      (item) =>
        item.department === schedule.department
        && item.section === schedule.section
        && item.currentSemester === (schedule.semester || subjectSemesterRoman)
    );
    if (alreadyListed) return classOptions;

    return [
      {
        _id: '',
        department: schedule.department,
        section: schedule.section,
        currentSemester: schedule.semester || subjectSemesterRoman,
        py: '—',
        __legacy: true,
      },
      ...classOptions,
    ];
  }, [classOptions, isEdit, schedule, subjectSemesterRoman]);

  useEffect(() => {
    const initialSubjectId = schedule?.subject || subject?._id || '';
    const initialSlot = schedule?.slot || slot || 'S1';
    const subjectForTimes = subjects.find((item) => item._id === initialSubjectId) || subject;
    const times = getSlotTimesForSubject(subjectForTimes, initialSlot);
    const matchedClass = classOptions.find(
      (item) =>
        item.department === schedule?.department
        && item.section === schedule?.section
        && item.currentSemester === (schedule?.semester || subjectSemesterRoman)
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
      semester: schedule?.semester || matchedClass?.currentSemester || subjectSemesterRoman,
    });
  }, [schedule, trainerCode, day, slot, subject, subjects, subjectSemesterRoman, classOptions]);

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
      const subjectItem = subjects.find((item) => item._id === value) || subject;
      const times = getSlotTimesForSubject(subjectItem, form.slot);
      setForm((prev) => ({
        ...prev,
        subjectId: value,
        slot: form.slot,
        startTime: times.startTime,
        endTime: times.endTime,
        classId: '',
        department: '',
        section: '',
      }));
      return;
    }
    if (name === 'slot') {
      applySlotTimes(form.subjectId, value);
      return;
    }
    if (name === 'classId') {
      const cls = visibleClassOptions.find((item) => item._id === value);
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
                <StyledSelect
                  id="slot-subject"
                  name="subjectId"
                  value={form.subjectId}
                  onChange={handleChange}
                  required
                  disabled={Boolean(subject) && !isEdit}
                  placeholder="Select subject"
                  options={[
                    { value: '', label: 'Select subject' },
                    ...subjects.map((item) => ({
                      value: item._id,
                      label: `${item.name} (${item.code})`,
                    })),
                  ]}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="slot-period">Period *</label>
                <StyledSelect
                  id="slot-period"
                  name="slot"
                  value={form.slot}
                  onChange={handleChange}
                  required
                  options={getActiveSlotKeys(selectedSubject).map((slotKey) => {
                    const times = getSlotTimesForSubject(selectedSubject, slotKey);
                    return {
                      value: slotKey,
                      label: `${slotKey} (${times.startTime} – ${times.endTime})`,
                    };
                  })}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="slot-day">Day *</label>
                <StyledSelect
                  id="slot-day"
                  name="day"
                  value={form.day}
                  onChange={handleChange}
                  required
                  options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((weekday) => ({
                    value: weekday,
                    label: weekday,
                  }))}
                />
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
                  <StyledSelect
                    id="slot-class"
                    name="classId"
                    value={form.classId}
                    onChange={handleChange}
                    required
                    placeholder="Select a registered class"
                    options={[
                      { value: '', label: 'Select a registered class' },
                      ...visibleClassOptions.map((item) => ({
                        value: item._id,
                        label: `${item.department} ${item.section} · PY ${item.py} · Sem ${item.currentSemester}${item.__legacy ? ' (current assignment)' : ''}`,
                      })),
                    ]}
                  />
                )}
                {!classesLoading && visibleClassOptions.length === 0 && (
                  <small className="text-muted d-block mt-1">
                    {subjectHasClassRestrictions(selectedSubject)
                      ? `No classes registered for this subject${subjectSemesterRoman ? ` in semester ${subjectSemesterRoman}` : ''}. Add matching classes under Classes & Students first.`
                      : `No classes registered for semester ${subjectSemesterRoman}. Add classes under Classes & Students first.`}
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
