import { buildTimetableGrid, WEEKDAYS, formatDayShort } from '../utils/timetableGrid.js';
import { formatTimeRange, formatScheduleClassLabel, formatScheduleVenueLabel } from '../utils/scheduleUtils.js';
import { getEffectiveSubjectCode } from '../utils/scheduleSubject.js';

const formatCellContent = (schedule, { showSubject, showTimingsInCells, trainerCode }) => {
  const classLabel = formatScheduleClassLabel(schedule);
  const venueLabel = formatScheduleVenueLabel(schedule);
  const timeLabel = formatTimeRange(schedule.startTime, schedule.endTime);
  const subjectCode = getEffectiveSubjectCode(schedule, trainerCode) || schedule.subjectCode;

  if (showTimingsInCells) {
    return (
      <>
        <small className="timetable-cell-meta">{timeLabel}</small>
        <span className="timetable-cell-class">{classLabel}</span>
        {venueLabel && <small className="timetable-cell-meta">Venue {venueLabel}</small>}
        {showSubject && subjectCode && (
          <small className="timetable-cell-meta">{subjectCode}</small>
        )}
      </>
    );
  }

  if (showSubject && subjectCode) {
    return (
      <>
        <span className="timetable-cell-class">{classLabel}</span>
        {venueLabel && <small className="timetable-cell-meta">Venue {venueLabel}</small>}
        <small className="timetable-cell-meta">{subjectCode}</small>
      </>
    );
  }

  return (
    <>
      <span className="timetable-cell-class">{classLabel}</span>
      {venueLabel && <small className="timetable-cell-meta">Venue {venueLabel}</small>}
    </>
  );
};

const TrainerTimetableGrid = ({
  schedules,
  trainerCode,
  subjectLabel,
  days = WEEKDAYS,
  fixedSlots = null,
  editMode = false,
  viewOnly = false,
  showSubjectInCells = false,
  showTimingsInCells = false,
  onCellClick,
}) => {
  const { timeSlots, cells, periodOnly } = buildTimetableGrid(
    schedules,
    days,
    fixedSlots,
    { periodOnlyMode: showTimingsInCells }
  );
  const hasFixedSlots = Boolean(fixedSlots?.length) || showTimingsInCells;
  const cellContentOptions = { showSubject: showSubjectInCells, showTimingsInCells, trainerCode };
  const allowCellEdit = editMode && !viewOnly && Boolean(onCellClick) && !showTimingsInCells;

  if (!hasFixedSlots && timeSlots.length === 0) {
    return (
      <div className="card table-card">
        <div className="card-body text-center text-muted py-5">
          No classes scheduled{trainerCode ? ` for ${trainerCode}` : ''}.
          {editMode && !viewOnly && (
            <p className="mb-0 mt-2 small">
              Add a subject above, then click a cell to create timetable slots.
            </p>
          )}
        </div>
      </div>
    );
  }

  const showHeaderLabel = subjectLabel && subjectLabel !== 'All subjects';

  return (
    <div className="card table-card timetable-card">
      {showHeaderLabel && (
        <div className="card-header bg-white border-bottom py-2 timetable-card-header">
          <small className="text-success fw-semibold">{subjectLabel}</small>
        </div>
      )}
      <div className="card-body p-0">
        <div className={`timetable-grid-wrap${showHeaderLabel ? '' : ' timetable-grid-wrap--full'}${viewOnly ? ' timetable-grid-wrap--view-only' : ''}`}>
          <table className={`table timetable-grid mb-0${viewOnly ? ' timetable-grid--view-only' : ''}`}>
            <thead>
              <tr>
                <th className="timetable-day-col timetable-head-day">Day</th>
                {timeSlots.map((slot) => (
                  <th key={slot.key || `${slot.startTime}-${slot.endTime}`} className="text-center timetable-slot-col">
                    {showTimingsInCells ? (
                      <span className="timetable-slot-key">{slot.headerLabel || slot.key}</span>
                    ) : (
                      <>
                        {slot.headerLabel && (
                          <span className="timetable-slot-key">{slot.headerLabel}</span>
                        )}
                        {slot.subLabel && (
                          <span className="timetable-slot-time">{slot.subLabel}</span>
                        )}
                      </>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day}>
                  <th scope="row" className="table-light timetable-day-col" title={day}>
                    {formatDayShort(day)}
                  </th>
                  {timeSlots.map((slot) => {
                    const columnKey = periodOnly ? slot.key : `${slot.startTime}|${slot.endTime}`;
                    const key = `${day}|${columnKey}`;
                    const schedule = cells[key];
                    const isClickable = allowCellEdit;
                    const cellClass = [
                      'text-center',
                      'timetable-cell',
                      schedule ? 'timetable-cell-filled' : 'timetable-cell-empty',
                      isClickable ? 'timetable-cell-editable' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    const hasSessionTag = Boolean(schedule?.isLab || schedule?.isProject);

                    return (
                      <td
                        key={key}
                        className={cellClass}
                        onClick={
                          isClickable
                            ? () => onCellClick({
                                schedule,
                                day,
                                slot: slot.key,
                                startTime: slot.startTime,
                                endTime: slot.endTime,
                              })
                            : undefined
                        }
                        onKeyDown={
                          isClickable
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onCellClick({
                                    schedule,
                                    day,
                                    slot: slot.key,
                                    startTime: slot.startTime,
                                    endTime: slot.endTime,
                                  });
                                }
                              }
                            : undefined
                        }
                        role={isClickable ? 'button' : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                        aria-label={
                          isClickable
                            ? `${day} ${slot.headerLabel || slot.subLabel}${schedule ? ', edit slot' : ', add slot'}`
                            : undefined
                        }
                      >
                        {hasSessionTag && (
                          <div className="timetable-cell-tags" aria-hidden="true">
                            {schedule?.isProject && (
                              <span className="timetable-session-tag timetable-session-tag--project">Project</span>
                            )}
                            {schedule?.isLab && (
                              <span className="timetable-session-tag timetable-session-tag--lab">Lab</span>
                            )}
                          </div>
                        )}
                        <div className={`timetable-cell-body${hasSessionTag ? ' timetable-cell-body--tagged' : ''}`}>
                          {schedule
                            ? formatCellContent(schedule, cellContentOptions)
                            : (allowCellEdit ? '+' : '—')}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrainerTimetableGrid;
