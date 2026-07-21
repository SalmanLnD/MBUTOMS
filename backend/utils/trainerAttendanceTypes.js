export const TRAINER_ATTENDANCE_TYPES = {
  OIF: 'oif',
  LEAVE: 'leave',
  LEAVE_OIF: 'leave_oif',
  LWO: 'lwo',
  COMP_OFF: 'comp_off',
  EXIT: 'exit',
  BREAK: 'break',
  WEEK_OFF: 'week_off',
  WEEK_OFF_OIF: 'week_off_oif',
  E_LEAVE: 'e_leave',
  HOLIDAY_OIF: 'holiday_oif',
  HOLIDAY: 'holiday',
};

export const LEAVE_ATTENDANCE_TYPES = [
  TRAINER_ATTENDANCE_TYPES.LEAVE,
  TRAINER_ATTENDANCE_TYPES.LEAVE_OIF,
  TRAINER_ATTENDANCE_TYPES.LWO,
  TRAINER_ATTENDANCE_TYPES.COMP_OFF,
  TRAINER_ATTENDANCE_TYPES.EXIT,
  TRAINER_ATTENDANCE_TYPES.BREAK,
  TRAINER_ATTENDANCE_TYPES.WEEK_OFF,
  TRAINER_ATTENDANCE_TYPES.WEEK_OFF_OIF,
  TRAINER_ATTENDANCE_TYPES.E_LEAVE,
  TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF,
  TRAINER_ATTENDANCE_TYPES.HOLIDAY,
];

export const attendanceTypeUsesOifNumber = (attendanceType) => [
  TRAINER_ATTENDANCE_TYPES.OIF,
  TRAINER_ATTENDANCE_TYPES.LEAVE_OIF,
  TRAINER_ATTENDANCE_TYPES.WEEK_OFF_OIF,
  TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF,
].includes(attendanceType);

export const isLeaveAttendanceType = (attendanceType) =>
  LEAVE_ATTENDANCE_TYPES.includes(attendanceType);

export const canEditFutureLeaveAttendance = ({ role, isOnFullDayLeave }) =>
  role === 'admin' && Boolean(isOnFullDayLeave);

export const LEAVE_ATTENDANCE_LABELS = {
  [TRAINER_ATTENDANCE_TYPES.LEAVE]: 'Leave',
  [TRAINER_ATTENDANCE_TYPES.LEAVE_OIF]: 'Leave - OIF Number',
  [TRAINER_ATTENDANCE_TYPES.LWO]: 'L.W.O',
  [TRAINER_ATTENDANCE_TYPES.COMP_OFF]: 'L - Comp Off',
  [TRAINER_ATTENDANCE_TYPES.EXIT]: 'Exit',
  [TRAINER_ATTENDANCE_TYPES.BREAK]: 'Break',
  [TRAINER_ATTENDANCE_TYPES.WEEK_OFF]: 'W.O',
  [TRAINER_ATTENDANCE_TYPES.WEEK_OFF_OIF]: 'W.Off - OIF Number',
  [TRAINER_ATTENDANCE_TYPES.E_LEAVE]: 'E-Leave',
  [TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF]: 'OIF Number - Holiday',
  [TRAINER_ATTENDANCE_TYPES.HOLIDAY]: 'Holiday',
};

const OIF_NUMBER_TOKEN = 'OIF Number';

/** Google Sheet / grid display for leave OIF cells — preserves the full OIF number. */
export const formatTrainerAttendanceOifDisplay = (attendanceType, oifNumber) => {
  const number = String(oifNumber ?? '').trim();

  if (isLeaveAttendanceType(attendanceType)) {
    const label = LEAVE_ATTENDANCE_LABELS[attendanceType];
    if (!label) return number;

    if (attendanceTypeUsesOifNumber(attendanceType)) {
      if (!number) {
        return label.replace(OIF_NUMBER_TOKEN, '').replace(/\s*-\s*$/, '').trim() || label;
      }
      return label.replace(OIF_NUMBER_TOKEN, number);
    }

    return label;
  }

  return number;
};
