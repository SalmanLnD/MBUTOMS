import { memo, Fragment } from 'react';
import {
  attendanceTypeUsesOifNumber,
  formatTrainerAttendanceOifDisplay,
  LEAVE_TYPE_OPTIONS,
} from '../utils/trainerAttendanceTypes.js';

const TrainerAttendanceRow = memo(({
  row,
  dates,
  canEditTrainer,
  canEditFutureLeave,
  savingKey,
  onUpdateCell,
  onSave,
}) => (
  <tr>
    <th scope="row" className="trainer-attendance-sticky-col">
      <div className="fw-semibold">{row.trainer.name}</div>
      <small className="text-muted">{row.trainer.employeeId}</small>
    </th>
    {dates.map((date) => {
      const cell = row.days[date.key] || {
        oifNumber: '',
        mockPrepHours: 0,
        classHandlingHours: 0,
      };
      const canEditCell = canEditTrainer(row.trainer._id) && (
        !date.isFuture || (cell.isOnLeave && canEditFutureLeave)
      );
      const editable = canEditCell && !cell.isOnLeave;
      const leaveTypeUsesOif = attendanceTypeUsesOifNumber(cell.attendanceType);
      const oifSheetValue = formatTrainerAttendanceOifDisplay(
        cell.attendanceType,
        cell.oifNumber
      );
      const saveKey = `${row.trainer._id}|${date.key}`;
      const isSaving = savingKey === saveKey;
      const futureClass = date.isFuture ? 'trainer-attendance-future' : '';
      const weekendClass = date.isWeekend ? 'trainer-attendance-weekend' : '';
      const cellClass = [futureClass, weekendClass].filter(Boolean).join(' ');

      return (
        <Fragment key={`${row.trainer._id}-${date.key}`}>
          <td className={`trainer-attendance-oif-cell ${cellClass}`}>
            {cell.isOnLeave ? (
              <div className="trainer-attendance-leave-controls">
                <select
                  className="form-select form-select-sm trainer-attendance-leave-select"
                  value={cell.attendanceType || ''}
                  disabled={!canEditCell || isSaving}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    onUpdateCell(row.trainer._id, date.key, 'attendanceType', nextType);
                    if (!attendanceTypeUsesOifNumber(nextType)) {
                      onUpdateCell(row.trainer._id, date.key, 'oifNumber', '');
                    }
                    window.setTimeout(() => onSave(row.trainer._id, date.key), 0);
                  }}
                  aria-label="Leave type"
                  title="Select leave type"
                >
                  <option value="">Leave type...</option>
                  {LEAVE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {leaveTypeUsesOif && (
                  <>
                    {oifSheetValue && (
                      <div
                        className="trainer-attendance-oif-sheet-value small fw-semibold"
                        title="Value for Google Sheet OIF column"
                      >
                        {oifSheetValue}
                      </div>
                    )}
                    <input
                      type="text"
                      className="form-control form-control-sm trainer-attendance-oif-input"
                      value={cell.oifNumber || ''}
                      maxLength={12}
                      disabled={!canEditCell || isSaving}
                      onChange={(e) => onUpdateCell(
                        row.trainer._id,
                        date.key,
                        'oifNumber',
                        e.target.value
                      )}
                      onBlur={() => canEditCell && onSave(row.trainer._id, date.key)}
                      placeholder="OIF number"
                      aria-label="OIF number"
                    />
                  </>
                )}
                {!leaveTypeUsesOif && cell.attendanceType && oifSheetValue && (
                  <div
                    className="trainer-attendance-oif-sheet-value small fw-semibold"
                    title="Value for Google Sheet OIF column"
                  >
                    {oifSheetValue}
                  </div>
                )}
              </div>
            ) : (
              <input
                type="text"
                className="form-control form-control-sm trainer-attendance-oif-input"
                value={cell.oifNumber}
                maxLength={12}
                disabled={!editable || isSaving}
                onChange={(e) => onUpdateCell(row.trainer._id, date.key, 'oifNumber', e.target.value)}
                onBlur={() => editable && onSave(row.trainer._id, date.key)}
                placeholder="—"
                title="Up to 12 characters"
              />
            )}
          </td>
          <td className={`trainer-attendance-mock-cell ${cellClass}`}>
            <input
              type="number"
              min="0"
              step="0.5"
              className="form-control form-control-sm trainer-attendance-mock-input"
              value={cell.mockPrepHours}
              disabled={!editable || isSaving}
              onChange={(e) => onUpdateCell(row.trainer._id, date.key, 'mockPrepHours', e.target.value)}
              onBlur={() => editable && onSave(row.trainer._id, date.key)}
            />
          </td>
          <td className={`trainer-attendance-class-cell ${cellClass}`}>
            <span className="trainer-attendance-class-value">
              {Number(cell.classHandlingHours || 0).toFixed(1)}
            </span>
          </td>
        </Fragment>
      );
    })}
    <td className="trainer-attendance-totals-col">
      <div className="trainer-attendance-totals-cell">
        <div>
          <span className="text-muted">Mock</span>
          <strong>{Number(row.totals?.mockPrepHours || 0).toFixed(1)}</strong>
        </div>
        <div>
          <span className="text-muted">Class</span>
          <strong>{Number(row.totals?.classHandlingHours || 0).toFixed(1)}</strong>
        </div>
        <div>
          <span className="text-muted">OIF days</span>
          <strong>{row.totals?.oifDays || 0}</strong>
        </div>
      </div>
    </td>
  </tr>
));

TrainerAttendanceRow.displayName = 'TrainerAttendanceRow';

export default TrainerAttendanceRow;
