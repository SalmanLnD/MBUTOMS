import { useState, useEffect } from 'react';
import { createSchedule, updateSchedule } from '../services/scheduleService.js';
import { getSubjects, getSemesters } from '../services/subjectService.js';
import { getTrainers } from '../services/trainerService.js';
import { getVenues } from '../services/venueService.js';
import { getBatches } from '../services/scheduleService.js';
import { getErrorMessage, toInputDate } from '../utils/helpers.js';
import Modal from './Modal.jsx';

const emptyForm = {
  date: toInputDate(new Date()),
  startTime: '09:00',
  endTime: '10:30',
  subject: '',
  trainer: '',
  venue: '',
  batch: '',
  semester: '',
  notes: '',
  status: 'scheduled',
};

const ScheduleFormModal = ({ schedule, defaultDate, onClose }) => {
  const [form, setForm] = useState(emptyForm);
  const [subjects, setSubjects] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [venues, setVenues] = useState([]);
  const [batches, setBatches] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(schedule);

  useEffect(() => {
    const loadOptions = async () => {
      const [subjRes, trainerRes, venueRes, batchData, semData] = await Promise.all([
        getSubjects({ limit: 100 }),
        getTrainers({ limit: 100 }),
        getVenues({ limit: 100, isActive: 'true' }),
        getBatches(),
        getSemesters(),
      ]);
      setSubjects(subjRes.subjects || []);
      setTrainers(trainerRes.trainers || []);
      setVenues(venueRes.venues || []);
      setBatches(batchData);
      setSemesters(semData);
    };
    loadOptions();
  }, []);

  useEffect(() => {
    if (schedule) {
      setForm({
        date: toInputDate(schedule.date),
        startTime: schedule.startTime || '09:00',
        endTime: schedule.endTime || '10:30',
        subject: schedule.subject?._id || schedule.subject || '',
        trainer: schedule.trainer?._id || schedule.trainer || '',
        venue: schedule.venue?._id || schedule.venue || '',
        batch: schedule.batch?._id || schedule.batch || '',
        semester: schedule.semester?._id || schedule.semester || '',
        notes: schedule.notes || '',
        status: schedule.status || 'scheduled',
      });
    } else if (defaultDate) {
      setForm((prev) => ({
        ...prev,
        date: toInputDate(defaultDate),
      }));
    }
  }, [schedule, defaultDate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-set semester when batch is selected
      if (name === 'batch' && value) {
        const batch = batches.find((b) => b._id === value);
        if (batch?.semester) {
          updated.semester = batch.semester._id || batch.semester;
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isEdit) {
        await updateSchedule(schedule._id, form);
      } else {
        await createSchedule(form);
      }
      onClose(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      show
      title={isEdit ? 'Edit Class' : 'Schedule Class'}
      onClose={() => onClose(false)}
      size="toms-modal-lg"
      scrollable
    >
      <form onSubmit={handleSubmit}>
        <div className="toms-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Date *</label>
                  <input type="date" name="date" className="form-control" value={form.date} onChange={handleChange} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Start Time *</label>
                  <input type="time" name="startTime" className="form-control" value={form.startTime} onChange={handleChange} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">End Time *</label>
                  <input type="time" name="endTime" className="form-control" value={form.endTime} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Subject *</label>
                  <select name="subject" className="form-select" value={form.subject} onChange={handleChange} required>
                    <option value="">Select subject</option>
                    {subjects.map((s) => (
                      <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Trainer *</label>
                  <select name="trainer" className="form-select" value={form.trainer} onChange={handleChange} required>
                    <option value="">Select trainer</option>
                    {trainers.map((t) => (
                      <option key={t._id} value={t._id}>{t.name} ({t.employeeId})</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Venue *</label>
                  <select name="venue" className="form-select" value={form.venue} onChange={handleChange} required>
                    <option value="">Select venue</option>
                    {venues.map((v) => (
                      <option key={v._id} value={v._id}>{v.name} — {v.building}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Batch *</label>
                  <select name="batch" className="form-select" value={form.batch} onChange={handleChange} required>
                    <option value="">Select batch</option>
                    {batches.map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Semester *</label>
                  <select name="semester" className="form-select" value={form.semester} onChange={handleChange} required>
                    <option value="">Select semester</option>
                    {semesters.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                {isEdit && (
                  <div className="col-md-6">
                    <label className="form-label">Status</label>
                    <select name="status" className="form-select" value={form.status} onChange={handleChange}>
                      <option value="scheduled">Scheduled</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                )}
                <div className="col-12">
                  <label className="form-label">Notes</label>
                  <textarea name="notes" className="form-control" rows="2" value={form.notes} onChange={handleChange} />
                </div>
              </div>
        </div>
        <div className="toms-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Schedule'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ScheduleFormModal;
