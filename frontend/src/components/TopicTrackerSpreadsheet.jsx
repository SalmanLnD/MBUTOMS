import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import {
  getTopicTrackerSessions,
  upsertTopicTrackerEntry,
} from '../services/topicTrackerService.js';
import { getErrorMessage } from '../utils/helpers.js';
import { showError, showSuccess } from '../utils/toast.js';
import {
  TOPIC_TRACKER_COLUMNS,
  SESSION_STATUS_VALUES,
  SESSION_STATUS_LABELS,
} from '../utils/topicTrackerConstants.js';
import { PlusIcon, TrashIcon } from './icons.jsx';

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

const getRowTopics = (row) => {
  if (Array.isArray(row.topicModulesCovered) && row.topicModulesCovered.length) {
    return row.topicModulesCovered;
  }
  return row.topicModuleCovered ? [row.topicModuleCovered] : [''];
};

const getSelectedTopics = (row) => [
  ...new Set(getRowTopics(row).map((topic) => String(topic || '').trim()).filter(Boolean)),
];

const buildEntryPayload = (row, trackerStatus) => {
  const topics = getSelectedTopics(row);
  return {
    scheduleId: row.scheduleId,
    date: row.date,
    trainerName: row.trainerName,
    branchYearSection: row.branchYearSection,
    roomNo: row.roomNo,
    courseName: row.courseName,
    topicModuleCovered: topics.join(', '),
    topicModulesCovered: topics,
    sessionStartTime: row.sessionStartTime,
    sessionEndTime: row.sessionEndTime,
    allottedStudents: Number(row.allottedStudents) || 0,
    noPresent: Number(row.noPresent) || 0,
    sessionStatus: row.sessionStatus,
    keyObservationsFeedback: row.keyObservationsFeedback,
    challengesFaced: row.challengesFaced,
    trackerStatus,
  };
};

const getRowKey = (row) => `${row.scheduleId}-${row.date}`;
const serializeEditableRow = (row) => JSON.stringify(buildEntryPayload(row, 'closed'));

const TopicTrackerSpreadsheet = ({
  show,
  onClose,
  date,
  subjectId,
  trainerId,
  title,
  canCloseEntries = true,
  highlightEntryId,
  highlightScheduleId,
  onHighlightComplete,
}) => {
  const [sessions, setSessions] = useState([]);
  const [dayLabel, setDayLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [dirtyRows, setDirtyRows] = useState(() => new Set());
  const baselineRowsRef = useRef(new Map());
  const [highlightActive, setHighlightActive] = useState(
    Boolean(highlightEntryId || highlightScheduleId)
  );
  const highlightedRowRef = useRef(null);
  const onHighlightCompleteRef = useRef(onHighlightComplete);
  onHighlightCompleteRef.current = onHighlightComplete;

  const fetchSessions = useCallback(async () => {
    if (!show || !date) return;
    setLoading(true);
    try {
      const data = await getTopicTrackerSessions({ date, subjectId, trainerId });
      const nextSessions = (data.sessions || []).map((row) => ({
        ...row,
        topicModulesCovered: getRowTopics(row),
      }));
      baselineRowsRef.current = new Map(
        nextSessions.map((row) => [getRowKey(row), serializeEditableRow(row)])
      );
      setDirtyRows(new Set());
      setSessions(nextSessions);
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

  useEffect(() => {
    setHighlightActive(Boolean(highlightEntryId || highlightScheduleId));
  }, [highlightEntryId, highlightScheduleId]);

  useEffect(() => {
    if (loading || !highlightActive) return undefined;
    const hasTarget = sessions.some((row) =>
      (highlightEntryId && row.entryId === highlightEntryId)
      || (highlightScheduleId && row.scheduleId === highlightScheduleId)
    );
    if (!hasTarget) {
      setHighlightActive(false);
      onHighlightCompleteRef.current?.();
      return undefined;
    }

    highlightedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timerId = window.setTimeout(() => {
      setHighlightActive(false);
      onHighlightCompleteRef.current?.();
    }, 3000);
    return () => window.clearTimeout(timerId);
  }, [loading, sessions, highlightActive, highlightEntryId, highlightScheduleId]);

  const updateRow = (index, field, value) => {
    const row = sessions[index];
    if (!row) return;
    const next = { ...row, [field]: value };
    if (field === 'topicModulesCovered') {
      next.topicModuleCovered = value.map((topic) => String(topic || '').trim())
        .filter(Boolean)
        .join(', ');
    }
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
    const rowKey = getRowKey(next);
    const isDirty = baselineRowsRef.current.get(rowKey) !== serializeEditableRow(next);
    setDirtyRows((current) => {
      const updated = new Set(current);
      if (isDirty) updated.add(rowKey);
      else updated.delete(rowKey);
      return updated;
    });
    setSessions((current) => current.map((item, i) => (i === index ? next : item)));
  };

  const updateTopic = (rowIndex, topicIndex, value) => {
    const topics = [...getRowTopics(sessions[rowIndex])];
    topics[topicIndex] = value;
    updateRow(rowIndex, 'topicModulesCovered', topics);
  };

  const addTopic = (rowIndex) => {
    updateRow(rowIndex, 'topicModulesCovered', [...getRowTopics(sessions[rowIndex]), '']);
  };

  const removeTopic = (rowIndex, topicIndex) => {
    const topics = getRowTopics(sessions[rowIndex]).filter((_, index) => index !== topicIndex);
    updateRow(rowIndex, 'topicModulesCovered', topics.length ? topics : ['']);
  };

  const saveRow = async (row, index) => {
    const key = getRowKey(row);
    if (!dirtyRows.has(key)) return;
    if (!getSelectedTopics(row).length) {
      showError('Select at least one topic before saving this slot.');
      return;
    }
    if (!row.sessionStatus?.trim()) {
      showError('Select a session status before saving this slot.');
      return;
    }

    setSavingKey(key);
    try {
      const saved = await upsertTopicTrackerEntry(buildEntryPayload(row, 'closed'));
      const nextRow = {
        ...row,
        entryId: saved._id,
        topicModuleCovered: saved.topicModuleCovered,
        topicModulesCovered: getRowTopics(saved),
        durationHrs: saved.durationHrs,
        attendancePercent: saved.attendancePercent,
        trackerStatus: saved.trackerStatus,
      };
      baselineRowsRef.current.set(key, serializeEditableRow(nextRow));
      setDirtyRows((current) => {
        const updated = new Set(current);
        updated.delete(key);
        return updated;
      });
      setSessions((prev) => prev.map((item, i) => (i === index ? nextRow : item)));
      showSuccess('Slot updated successfully');
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSavingKey('');
    }
  };

  const renderCell = (row, column, index) => {
    const value = row[column.key] ?? '';
    const rowKey = getRowKey(row);
    const isSaving = savingKey === rowKey;
    const isDirty = dirtyRows.has(rowKey);

    if (column.key === 'trackerStatus') {
      return (
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => saveRow(row, index)}
          disabled={!canCloseEntries || isSaving || !isDirty}
          title={canCloseEntries ? (isDirty ? 'Save changes' : 'No changes to save') : 'Status'}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      );
    }

    if (column.key === 'sessionStatus') {
      const valueNotInList = value && !SESSION_STATUS_VALUES.includes(value);

      return (
        <select
          className="form-select form-select-sm topic-tracker-cell-input"
          value={value}
          onChange={(e) => updateRow(index, column.key, e.target.value)}
          disabled={isSaving}
          aria-label="Session Status"
        >
          <option value="">Select status...</option>
          {valueNotInList && (
            <option value={value}>{value}</option>
          )}
          {SESSION_STATUS_VALUES.map((status) => (
            <option key={status} value={status}>
              {SESSION_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      );
    }

    if (column.key === 'topicModuleCovered') {
      const options = row.topicOptions || [];
      const topics = getRowTopics(row);
      const selectedTopics = new Set(topics.filter(Boolean));
      return (
        <div className="topic-tracker-topics">
          {topics.map((topic, topicIndex) => {
            const valueNotInList = topic && options.length && !options.includes(topic);
            return (
              <div className="topic-tracker-topic-row" key={`${topicIndex}-${topic}`}>
                {options.length ? (
                  <select
                    className="form-select form-select-sm topic-tracker-cell-input topic-tracker-topic-select"
                    value={topic}
                    onChange={(e) => updateTopic(index, topicIndex, e.target.value)}
                    disabled={isSaving}
                    aria-label={`Topic / Module Covered ${topicIndex + 1}`}
                  >
                    <option value="">Select topic...</option>
                    {valueNotInList && <option value={topic}>{topic}</option>}
                    {options.map((option) => (
                      <option
                        key={option}
                        value={option}
                        disabled={option !== topic && selectedTopics.has(option)}
                      >
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-control form-control-sm topic-tracker-cell-input topic-tracker-topic-select"
                    value={topic}
                    onChange={(e) => updateTopic(index, topicIndex, e.target.value)}
                    disabled={isSaving}
                    aria-label={`Topic / Module Covered ${topicIndex + 1}`}
                  />
                )}
                {topics.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger topic-tracker-topic-action"
                    onClick={() => removeTopic(index, topicIndex)}
                    disabled={isSaving}
                    aria-label={`Remove topic ${topicIndex + 1}`}
                    title="Remove topic"
                  >
                    <TrashIcon size={14} />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="btn btn-sm btn-outline-primary topic-tracker-add-topic"
            onClick={() => addTopic(index)}
            disabled={isSaving || topics.some((topic) => !topic)}
            aria-label="Add another topic"
            title={topics.some((topic) => !topic) ? 'Select the current topic first' : 'Add another topic'}
          >
            <PlusIcon size={14} />
            <span>Add topic</span>
          </button>
        </div>
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
        disabled={isSaving}
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
      dismissible={false}
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
                    <th key={column.key} style={{ minWidth: column.width }}>
                      {column.key === 'trackerStatus' ? 'Action' : column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((row, index) => {
                  const isHighlighted = highlightActive && (
                    (highlightEntryId && row.entryId === highlightEntryId)
                    || (highlightScheduleId && row.scheduleId === highlightScheduleId)
                  );
                  return (
                  <tr
                    key={`${row.scheduleId}-${row.date}`}
                    ref={isHighlighted ? highlightedRowRef : undefined}
                    className={isHighlighted ? 'notification-target-highlight' : ''}
                  >
                    <td className="topic-tracker-slot-col fw-semibold small">
                      {row.slot || row.sessionStartTime}
                    </td>
                    {TOPIC_TRACKER_COLUMNS.map((column) => (
                      <td key={column.key}>{renderCell(row, column, index)}</td>
                    ))}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="toms-modal-footer">
        <p className="small text-muted mb-0 me-auto">
          Change any editable value, then click Save. Rows without changes cannot be saved.
          Unsaved changes are kept until you click Close.
        </p>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
};

export default TopicTrackerSpreadsheet;
