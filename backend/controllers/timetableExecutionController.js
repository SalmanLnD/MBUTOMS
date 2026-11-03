import ClassCancellation from '../models/ClassCancellation.js';
import Schedule from '../models/Schedule.js';
import TopicTrackerEntry from '../models/TopicTrackerEntry.js';
import { normalizeAttendanceDate, toAttendanceDateKey } from '../utils/attendanceTracking.js';
import { loadOfficialHolidayMap } from '../utils/officialHolidays.js';
import { SPECIAL_CLASS_FIELDS } from '../utils/specialClass.js';
import { buildSubjectStartDateMap, DEFAULT_SUBJECT_START_DATE } from '../utils/subjectStartDate.js';
import {
  TIMETABLE_EXECUTION_START,
  summarizeTimetableExecution,
} from '../utils/timetableExecutionHours.js';
import { getDataRevision } from '../utils/dataRevision.js';

let cachedExecutionReport = null;
let cachedExecutionRevision = -1;
let cachedExecutionAt = 0;
let cachedExecutionToKey = '';
const CACHE_TTL_MS = 120_000;

export const getTimetableExecutionHours = async (req, res) => {
  const from = normalizeAttendanceDate(TIMETABLE_EXECUTION_START);
  const today = normalizeAttendanceDate(new Date());
  const to = today < from ? from : today;
  const fromKey = toAttendanceDateKey(from);
  const toKey = toAttendanceDateKey(to);

  const currentRevision = getDataRevision();
  if (
    cachedExecutionReport
    && cachedExecutionRevision === currentRevision
    && cachedExecutionToKey === toKey
    && Date.now() - cachedExecutionAt < CACHE_TTL_MS
  ) {
    return res.json(cachedExecutionReport);
  }

  const [schedules, holidayMap, cancellations, subjectMap, completedEntries] = await Promise.all([
    Schedule.find()
      .select(`day startTime endTime department section subjectCode subject ${SPECIAL_CLASS_FIELDS}`)
      .populate('subject', 'name code')
      .lean(),
    loadOfficialHolidayMap(from, to),
    ClassCancellation.find({ date: { $gte: from, $lte: to } }).select('date schedules').lean(),
    buildSubjectStartDateMap(),
    TopicTrackerEntry.find({ date: { $gte: new Date(from.getTime() - 19800000), $lt: new Date(to.getTime() + 86400000) },
      trackerStatus: 'closed', sessionStatus: 'completed' }).select('date schedule').lean(),
  ]);

  const canceledByDate = new Map();
  cancellations.forEach((entry) => {
    const key = toAttendanceDateKey(entry.date);
    const ids = canceledByDate.get(key) || new Set();
    (entry.schedules || []).forEach((id) => ids.add(String(id)));
    canceledByDate.set(key, ids);
  });

  const completedByDate = new Map();
  completedEntries.forEach((entry) => {
    const key = toAttendanceDateKey(entry.date);
    const ids = completedByDate.get(key) || new Set();
    ids.add(String(entry.schedule));
    completedByDate.set(key, ids);
  });

  const report = summarizeTimetableExecution({
    schedules,
    holidayDates: new Set(holidayMap.keys()),
    canceledByDate,
    completedByDate,
    subjectMap: subjectMap?.byId ? subjectMap : { byId: new Map(), byCode: new Map() },
    fromKey,
    toKey,
  });

  const responsePayload = {
    ...report,
    subjectWindowStart: toAttendanceDateKey(DEFAULT_SUBJECT_START_DATE),
  };

  cachedExecutionReport = responsePayload;
  cachedExecutionRevision = currentRevision;
  cachedExecutionAt = Date.now();
  cachedExecutionToKey = toKey;

  res.json(responsePayload);
};
