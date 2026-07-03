import { buildTimetableGrid, WEEKDAYS, formatDayShort } from '../utils/timetableGrid.js';
import { formatTimeRange, formatScheduleClassLabel } from '../utils/scheduleUtils.js';
import { getEffectiveSubjectCode } from '../utils/scheduleSubject.js';

const formatCellContent = (schedule, { showSubject, showTimingsInCells, trainerCode }) => {
  const classLabel = formatScheduleClassLabel(schedule);
  const timeLabel = formatTimeRange(schedule.startTime, schedule.endTime);
  const subjectCode = getEffectiveSubjectCode(schedule, trainerCode) || schedule.subjectCode;

  if (showTimingsInCells) {
    return (
      <>
        <small className="text-muted d-block">{timeLabel}</small>
        <span className="d-block fw-semibold">{classLabel}</span>
        {showSubject && subjectCode && (
          <small className="text-muted d-block">{subjectCode}</small>
        )}
      </>
    );
  }

  if (showSubject && subjectCode) {
    return (
      <>
        <span className="d-block fw-semibold">{classLabel}</span>
        <small className="text-muted">{subjectCode}</small>
      </>
    );
  }

  return classLabel;
};

const TrainerTimetableGrid = ({
  schedules,
  trainerCode,
  subjectLabel,
  days = WEEKDAYS,
  fixedSlots = null,
  editMode = false,
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

  if (!hasFixedSlots && timeSlots.length === 0) {
    return (
      <div className="card table-card">
        <div className="card-body text-center text-muted py-5">
          No classes scheduled{trainerCode ? ` for ${trainerCode}` : ''}.
          {editMode && (
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
        <div className={`timetable-grid-wrap${showHeaderLabel ? '' : ' timetable-grid-wrap--full'}`}>
          <table className="table timetable-grid mb-0">
            <thead className="table-light">
              <tr>
                <th className="timetable-day-col">Day</th>
                {timeSlots.map((slot) => (
                  <th key={slot.key || `${slot.startTime}-${slot.endTime}`} className="text-center timetable-slot-col">
                    {showTimingsInCells ? (
                      <span className="d-block fw-bold">{slot.headerLabel || slot.key}</span>
                    ) : (
                      <>
                        {slot.headerLabel && (
                          <span className="d-block fw-bold">{slot.headerLabel}</span>
                        )}
                        <span className={slot.headerLabel ? 'd-block small text-muted' : ''}>
                          {slot.subLabel}
                        </span>
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
                    const isClickable = editMode && onCellClick && !showTimingsInCells;
                    const cellClass = [
                      'text-center',
                      'timetable-cell',
                      schedule ? 'timetable-cell-filled' : 'timetable-cell-empty',
                      isClickable ? 'timetable-cell-editable' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

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
                        {schedule
                          ? formatCellContent(schedule, cellContentOptions)
                          : (editMode && !showTimingsInCells ? '+' : '—')}
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
