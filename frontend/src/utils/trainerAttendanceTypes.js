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

export const LEAVE_TYPE_OPTIONS = [
  { value: TRAINER_ATTENDANCE_TYPES.LEAVE, label: 'Leave' },
  { value: TRAINER_ATTENDANCE_TYPES.LEAVE_OIF, label: 'Leave - OIF Number' },
  { value: TRAINER_ATTENDANCE_TYPES.LWO, label: 'L.W.O' },
  { value: TRAINER_ATTENDANCE_TYPES.COMP_OFF, label: 'L - Comp Off' },
  { value: TRAINER_ATTENDANCE_TYPES.EXIT, label: 'Exit' },
  { value: TRAINER_ATTENDANCE_TYPES.BREAK, label: 'Break' },
  { value: TRAINER_ATTENDANCE_TYPES.WEEK_OFF, label: 'W.O' },
  { value: TRAINER_ATTENDANCE_TYPES.WEEK_OFF_OIF, label: 'W.Off - OIF Number' },
  { value: TRAINER_ATTENDANCE_TYPES.E_LEAVE, label: 'E-Leave' },
  { value: TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF, label: 'OIF Number - Holiday' },
  { value: TRAINER_ATTENDANCE_TYPES.HOLIDAY, label: 'Holiday' },
];

export const attendanceTypeUsesOifNumber = (attendanceType) => [
  TRAINER_ATTENDANCE_TYPES.LEAVE_OIF,
  TRAINER_ATTENDANCE_TYPES.WEEK_OFF_OIF,
  TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF,
].includes(attendanceType);

export const isLeaveAttendanceType = (attendanceType) =>
  LEAVE_TYPE_OPTIONS.some((option) => option.value === attendanceType);

export const isItOif = (oifNumber) => {
  const value = String(oifNumber || '').trim().toUpperCase();
  return value.startsWith('IT');
};

export const countsAsOifDay = (oifNumber) => {
  const value = String(oifNumber || '').trim();
  return Boolean(value) && !isItOif(value);
};

/** Campus course OIFs — class hours stay auto from the timetable. */
const CAMPUS_SUBJECT_OIFS = new Set([
  'CT27004', 'IDSA', 'PR/IDSA', '22CS102033',
  'CT27005', 'PSTP', 'PR/PSTP', '22CS102034',
  'CT27006', 'LRRE', 'PR/LRRE', '22LG101703',
  'CT27007', 'PSTJ', 'PR/PSTJ', '22CA102006',
  'CT27008', 'DSAP', 'PR/DSAP', '25CA202009',
  'CT27009', 'QAVA', 'PR/QAVA', '22LG101702',
]);

/** Non-campus OIFs open the class-hours column for manual entry. */
export const allowsManualClassHandlingHours = (oifNumber) => {
  const value = String(oifNumber || '').trim();
  if (!value || isItOif(value)) return false;
  return !CAMPUS_SUBJECT_OIFS.has(value.toUpperCase());
};

const OIF_NUMBER_TOKEN = 'OIF Number';

/** Google Sheet / grid display for leave OIF cells — preserves the full OIF number. */
export const formatTrainerAttendanceOifDisplay = (attendanceType, oifNumber) => {
  const number = String(oifNumber ?? '').trim();

  const leaveOption = LEAVE_TYPE_OPTIONS.find((option) => option.value === attendanceType);
  if (leaveOption) {
    const { label } = leaveOption;

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
