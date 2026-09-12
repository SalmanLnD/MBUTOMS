import fs from 'node:fs';
const edit=(f,fn)=>fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')));
edit('backend/utils/topicTrackerSessions.js',s=>{
  s="import { getScheduleSubjectRange } from './subjectStartDate.js';\n"+s;
  const start=s.indexOf('const resolveScheduleStartDate =');
  const end=s.indexOf('/**\n * All schedule slots',start);
  s=s.slice(0,start)+s.slice(end);
  s=s.replace('  const untilDate = normalizeAttendanceDate(until || getAttendanceToday());',`  const today = getAttendanceToday();
  const requestedUntil = normalizeAttendanceDate(until || today);
  if (Number.isNaN(requestedUntil.getTime()) || (from && !toAttendanceDateKey(from))) {
    throw Object.assign(new Error('Use valid calendar dates for the backlog range.'), { statusCode: 400 });
  }
  const untilDate = requestedUntil > today ? today : requestedUntil;`);
  s=s.replace('  const dates = getAttendanceCalendarDates(fromDate, untilDate);',`  if ((untilDate - fromDate) / 86_400_000 > 730) {
    throw Object.assign(new Error('Choose a backlog range of at most two years.'), { statusCode: 400 });
  }
  const dates = getAttendanceCalendarDates(fromDate, untilDate);
  const dateKeys = dates.map(toAttendanceDateKey);
  const rangeWindow = getLeaveOverlapFilter(fromDate, untilDate);
  const dateFilter = { $gte: rangeWindow.endDate.$gte, $lt: rangeWindow.startDate.$lt };`);
  // Include both historical midnight encodings in the DB range.
  const bstart=s.indexOf('export const buildTopicTrackerPendingBacklog');
  const bend=s.indexOf('export const buildTopicTrackerExportRows',bstart);
  let block=s.slice(bstart,bend);
  block=block.replaceAll('date: { $gte: fromDate, $lte: untilDate }','date: dateFilter');
  block=block.replaceAll('.lean(),','.maxTimeMS(8_000).lean(),');
  block=block.replace('  schedules.forEach((schedule) => {',`  const rangeBySchedule = new Map();
  schedules.forEach((schedule) => {
    rangeBySchedule.set(String(schedule._id), getScheduleSubjectRange(schedule, subjectStartMap));`);
  block=block.replace(`        if (!isDateWithinLeave(date, leave)) return;
        const dateKey = toAttendanceDateKey(date);`, `        const dateKey = date.toISOString().slice(0, 10);
        if (dateKey < leave.fromKey || dateKey > leave.untilKey) return;`);
  block=block.replace('  replacementLeaves.forEach((leave) => {', `  replacementLeaves.forEach((leave) => {
    leave.fromKey = toLeaveDateKey(leave.startDate);
    leave.untilKey = toLeaveDateKey(leave.endDate);`);
  block=block.replace(`  dates.forEach((date) => {
    const dateKey = toAttendanceDateKey(date);`, `  // Yield between dates so health checks and interactive requests remain responsive.
  for (const [dateIndex, date] of dates.entries()) {
    if (dateIndex % 7 === 0) await new Promise((resolve) => setImmediate(resolve));
    const dateKey = dateKeys[dateIndex];`);
  block=block.replace('    if (holidayMap.has(dateKey)) return;', '    if (holidayMap.has(dateKey)) continue;');
  block=block.replace('      if (!isScheduleActiveOnDateKey(schedule, dateKey, subjectStartMap)) return;', '      const range = rangeBySchedule.get(scheduleId);\n      if (date < range.startDate || date > range.endDate) return;');
  block=block.replace('  });\n\n  pendingItems.sort', '  }\n\n  pendingItems.sort');
  s=s.slice(0,bstart)+block+s.slice(bend);
  return s;
});
edit('backend/controllers/topicTrackerController.js',s=>{
  s="import { createAsyncReportCache } from '../utils/asyncReportCache.js';\nconst readBacklog = createAsyncReportCache({ ttlMs: 30_000, maxEntries: 8 });\n"+s;
  s=s.replace('if (isAuthorizedRole(user?.role, FULL_ACCESS_ROLES)) return true;', 'if (FULL_ACCESS_ROLES.includes(user?.role)) return true;');
  const start=s.indexOf('  const backlog = await buildTopicTrackerPendingBacklog');
  const end=s.indexOf('\n};',start);
  return s.slice(0,start)+`  const scopeKey = JSON.stringify([req.user._id, req.user.role, req.user.trainer,
    req.user.coordinatorSubjects, req.query.from || '', req.query.until || '', new Date().toISOString().slice(0,10)]);
  const backlog = await readBacklog(scopeKey, () => buildTopicTrackerPendingBacklog({
    until: req.query.until, from: req.query.from, user: req.user,
  }));
  const subjectOptions = new Map();
  const trainerOptions = new Map();
  for (const row of backlog.items) {
    const subjectKey = row.subjectId || row.subjectCode || row.courseName;
    if (subjectKey) subjectOptions.set(subjectKey, { value: subjectKey, label: row.courseName || row.subjectCode });
    if (row.trainerId) trainerOptions.set(row.trainerId, { value: row.trainerId, label: row.trainerName });
  }
  const filtered = backlog.items.filter((row) =>
    (!req.query.subjectId || req.query.subjectId === (row.subjectId || row.subjectCode || row.courseName))
    && (!req.query.trainerId || req.query.trainerId === row.trainerId));
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  const pages = Math.max(1, Math.ceil(filtered.length / limit));
  const page = Math.min(pages, Math.max(1, Number.parseInt(req.query.page, 10) || 1));
  res.json({ ...backlog, items: filtered.slice((page - 1) * limit, page * limit),
    pagination: { page, pages, limit, total: filtered.length },
    subjectOptions: [...subjectOptions.values()].sort((a,b) => a.label.localeCompare(b.label)),
    trainerOptions: [...trainerOptions.values()].sort((a,b) => a.label.localeCompare(b.label)),
  });`+s.slice(end);
});
edit('backend/utils/rtetExport.js',s=>{
  s="import { isScheduleWithinSubjectDates } from './subjectStartDate.js';\n"+s;
  const start=s.indexOf('const isActiveOnDate =');const end=s.indexOf('\n};',start)+3;
  return (s.slice(0,start)+'const isActiveOnDate = isScheduleWithinSubjectDates;'+s.slice(end)).replace('subjectStartMap.byCode.get(subject.code) || DEFAULT_SUBJECT_START_DATE','subjectStartMap.byCode.get(subject.code)?.startDate || DEFAULT_SUBJECT_START_DATE').replace('apply only subject start dates','apply inclusive subject start/end dates');
});
edit('backend/utils/liveTrainerVenues.js',s=>{
  s="import { isScheduleWithinSubjectDates } from './subjectStartDate.js';\n"+s;
  const start=s.indexOf('const isSubjectStarted =');const end=s.indexOf('\n};',start)+3;
  return s.slice(0,start)+'const isSubjectStarted = (schedule, ref, byId, byCode) =>\n  isScheduleWithinSubjectDates(schedule, ref, { byId, byCode });'+s.slice(end);
});
edit('backend/utils/trainerScheduleView.js',s=>{
  s="import { filterSchedulesActiveOnDate } from './activeSchedulesForDate.js';\n"+s;
  s=s.replace('  return [\n    ...owned.map','  return filterSchedulesActiveOnDate([\n    ...owned.map');
  return s.replace('    ...replacementSchedules,\n  ];','    ...replacementSchedules,\n  ], referenceDate);');
});
edit('backend/controllers/subjectController.js',s=>s.replace("import { normalizeDate } from '../utils/scheduleHelpers.js';", "import { normalizeAttendanceDate as normalizeDate } from '../utils/attendanceTracking.js';").replace('  if (payload.endDate) {\n    payload.endDate = normalizeDate(payload.endDate);\n  }','  if (payload.endDate !== undefined) {\n    payload.endDate = payload.endDate ? normalizeDate(payload.endDate) : null;\n  }'));
edit('backend/models/Subject.js',s=>s.replace("endDate: { type: Date, default: null },", `endDate: { type: Date, default: null, validate: {
      validator(value) { return !value || !this.startDate || value >= this.startDate; },
      message: 'End date must be on or after start date.',
    } },`));
edit('backend/utils/validators.js',s=>s.replace("body('startDate').notEmpty().withMessage('Start date is required'),", "body('startDate').isISO8601({ strict: true }).withMessage('A valid start date is required'),\n  body('endDate').optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('A valid end date is required'),"));
edit('backend/middleware/errorHandler.js',s=>s.replace('  const statusCode = err.statusCode || fallback;',"  const statusCode = err.statusCode || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : err.code === 11000 ? 409 : fallback);").replace('  res.status(statusCode).json({','  if (res.headersSent) return next(err);\n  res.status(statusCode).json({'));
edit('frontend/src/services/topicTrackerService.js',s=>s.replace('getTopicTrackerPendingBacklog = async (params = {})','getTopicTrackerPendingBacklog = async (params = {}, options = {})').replace("api.get('/topic-tracker/pending-backlog', { params })", "api.get('/topic-tracker/pending-backlog', { params, signal: options.signal, skipRetry: true, timeout: 20_000 })"));
