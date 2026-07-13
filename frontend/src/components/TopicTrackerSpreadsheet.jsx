import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import {
  getTopicTrackerSessions,
  upsertTopicTrackerEntry,
  updateTopicTrackerStatus,
} from '../services/topicTrackerService.js';
import { getErrorMessage } from '../utils/helpers.js';
import { showError, showSuccess } from '../utils/toast.js';
import {
  TOPIC_TRACKER_COLUMNS,
  TOPIC_TRACKER_STATUS_LABELS,
  getTopicTrackerStatusBadgeClass,
} from '../utils/topicTrackerConstants.js';

const computeAttendancePercent = (allotted, present) => {
  if (!allotted || allotted <= 0) return '';
  return String(Math.round((present / allotted) * 1000) / 10);
};

const computeDuration = (start, end) => {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return '';
  return String(Math.round((diff / 60) * 10) / 10);
};

const TopicTrackerSpreadsheet = ({
  show,
  onClose,
  date,
  subjectId,
  trainerId,
  title,
  canCloseEntries = true,
}) => {
  const [sessions, setSessions] = useState([]);
  const [dayLabel, setDayLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');

  const fetchSessions = useCallback(async () => {
    if (!show || !date) return;
    setLoading(true);
    try {
      const data = await getTopicTrackerSessions({ date, subjectId, trainerId });
      setSessions(data.sessions || []);
      setDayLabel(data.day || '');
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [show, date, subjectId, trainerId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const updateRow = (index, field, value) => {
    setSessions((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const next = { ...row, [field]: value };
      if (field === 'sessionStartTime' || field === 'sessionEndTime') {
        next.durationHrs = computeDuration(
          field === 'sessionStartTime' ? value : row.sessionStartTime,
          field === 'sessionEndTime' ? value : row.sessionEndTime
        );
      }
      if (field === 'allottedStudents' || field === 'noPresent') {
        const allotted = field === 'allottedStudents' ? Number(value) : Number(row.allottedStudents);
        const present = field === 'noPresent' ? Number(value) : Number(row.noPresent);
        next.attendancePercent = computeAttendancePercent(allotted, present);
      }
      return next;
    }));
  };

  const saveRow = async (row, index) => {
    const key = `${row.scheduleId}-${row.date}`;
    setSavingKey(key);
    try {
      const saved = await upsertTopicTrackerEntry({
        scheduleId: row.scheduleId,
        date: row.date,
        trainerName: row.trainerName,
        branchYearSection: row.branchYearSection,
        roomNo: row.roomNo,
        courseName: row.courseName,
        topicModuleCovered: row.topicModuleCovered,
        sessionStartTime: row.sessionStartTime,
        sessionEndTime: row.sessionEndTime,
        allottedStudents: Number(row.allottedStudents) || 0,
        noPresent: Number(row.noPresent) || 0,
        sessionStatus: row.sessionStatus,
        keyObservationsFeedback: row.keyObservationsFeedback,
        challengesFaced: row.challengesFaced,
      });
      setSessions((prev) => prev.map((item, i) => (i === index ? {
        ...item,
        entryId: saved._id,
        durationHrs: saved.durationHrs,
        attendancePercent: saved.attendancePercent,
        trackerStatus: saved.trackerStatus,
      } : item)));
      showSuccess('Entry saved');
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSavingKey('');
    }
  };

  const toggleStatus = async (row, index) => {
    if (!canCloseEntries) return;
    const nextStatus = row.trackerStatus === 'closed' ? 'pending' : 'closed';
    setSavingKey(`${row.scheduleId}-${row.date}`);
    try {
      if (row.entryId) {
        const saved = await updateTopicTrackerStatus(row.entryId, nextStatus);
        setSessions((prev) => prev.map((item, i) => (i === index ? {
          ...item,
          trackerStatus: saved.trackerStatus,
        } : item)));
      } else {
        const saved = await upsertTopicTrackerEntry({
          scheduleId: row.scheduleId,
          date: row.date,
          topicModuleCovered: row.topicModuleCovered,
          trackerStatus: nextStatus,
        });
        setSessions((prev) => prev.map((item, i) => (i === index ? {
          ...item,
          entryId: saved._id,
          trackerStatus: saved.trackerStatus,
        } : item)));
      }
      showSuccess(`Marked as ${TOPIC_TRACKER_STATUS_LABELS[nextStatus]}`);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSavingKey('');
    }
  };

  const renderCell = (row, column, index) => {
    const value = row[column.key] ?? '';

    if (column.key === 'trackerStatus') {
      return (
        <button
          type="button"
          className={`badge border-0 ${getTopicTrackerStatusBadgeClass(row.trackerStatus)}`}
          onClick={() => toggleStatus(row, index)}
          disabled={!canCloseEntries || savingKey === `${row.scheduleId}-${row.date}`}
          title={canCloseEntries ? 'Click to toggle pending/closed' : 'Status'}
        >
          {TOPIC_TRACKER_STATUS_LABELS[row.trackerStatus] || 'Pending'}
        </button>
      );
    }

    if (column.key === 'topicModuleCovered' && row.topicOptions?.length) {
      const options = row.topicOptions;
      const valueNotInList = value && !options.includes(value);

      return (
        <select
          className="form-select form-select-sm topic-tracker-cell-input topic-tracker-topic-select"
          value={value}
          onChange={(e) => {
            const newValue = e.target.value;
            updateRow(index, column.key, newValue);
            saveRow({ ...row, topicModuleCovered: newValue }, index);
          }}
          disabled={savingKey === `${row.scheduleId}-${row.date}`}
          aria-label="Topic / Module Covered"
        >
          <option value="">Select topic...</option>
          {valueNotInList && (
            <option value={value}>{value}</option>
          )}
          {options.map((topic) => (
            <option key={topic} value={topic}>{topic}</option>
          ))}
        </select>
      );
    }

    if (column.readOnly) {
      return <span className="topic-tracker-cell-text">{value}</span>;
    }

    const inputType = ['allottedStudents', 'noPresent'].includes(column.key) ? 'number' : 'text';

    return (
      <input
        type={inputType}
        className="form-control form-control-sm topic-tracker-cell-input"
        value={value}
        min={inputType === 'number' ? 0 : undefined}
        onChange={(e) => updateRow(index, column.key, e.target.value)}
        onBlur={() => saveRow(row, index)}
        disabled={savingKey === `${row.scheduleId}-${row.date}`}
      />
    );
  };

  return (
    <Modal
      show={show}
      title={title || `Topic Tracker — ${date}${dayLabel ? ` (${dayLabel})` : ''}`}
      onClose={onClose}
      size="toms-modal-xl"
      scrollable
    >
      <div className="toms-modal-body p-0">
        {loading ? (
          <LoadingSpinner message="Loading sessions..." />
        ) : sessions.length === 0 ? (
          <div className="p-4 text-muted">No scheduled sessions for this day.</div>
        ) : (
          <div className="topic-tracker-sheet-wrap">
            <table className="table table-sm table-bordered topic-tracker-sheet mb-0">
              <thead>
                <tr>
                  <th className="topic-tracker-slot-col">Slot</th>
                  {TOPIC_TRACKER_COLUMNS.map((column) => (
                    <th key={column.key} style={{ minWidth: column.width }}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((row, index) => (
                  <tr key={`${row.scheduleId}-${row.date}`}>
                    <td className="topic-tracker-slot-col fw-semibold small">
                      {row.slot || row.sessionStartTime}
                    </td>
                    {TOPIC_TRACKER_COLUMNS.map((column) => (
                      <td key={column.key}>{renderCell(row, column, index)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="toms-modal-footer">
        <p className="small text-muted mb-0 me-auto">
          Changes save when you leave a cell or select a topic. Click tracker status to mark pending or closed.
        </p>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
};

export default TopicTrackerSpreadsheet;
