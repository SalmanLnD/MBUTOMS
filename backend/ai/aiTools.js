import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';
import Venue from '../models/Venue.js';
import Leave from '../models/Leave.js';
import { FULL_ACCESS_ROLES, MANAGEMENT_ROLES, ROLES, isAuthorizedRole } from '../utils/roles.js';
import { coordinatorCanAccessTrainer, isSubjectCoordinator, getCoordinatorSubjectIds, buildTrainerFilterForCoordinatorSubjects } from '../utils/subjectCoordinatorAccess.js';
import { excludeArchivedExternalTrainers } from '../utils/externalTrainerArchive.js';
import { getIstNowParts, buildLiveTrainerVenues } from '../utils/liveTrainerVenues.js';
import { computeClassHandlingHoursBatch } from '../utils/trainerClassHoursBatch.js';
import { getLeaves } from '../controllers/leaveController.js';
import { getSpecialClasses } from '../controllers/scheduleController.js';
import { getClasses } from '../controllers/classController.js';
import { getTopicTrackerSessions, getTopicTrackerClassSummary } from '../controllers/topicTrackerController.js';
import { buildTrainerAttendanceGridPayload, getTrainerPunchInLogs } from '../controllers/trainerAttendanceController.js';
import { toAttendanceDateKey, normalizeAttendanceDate, getAttendanceCalendarDates } from '../utils/attendanceDates.js';
import { getWeekRangeForDate } from '../utils/specialClass.js';
import { loadOfficialHolidayMap } from '../utils/officialHolidays.js';
import { getLeaveOverlapFilter } from '../utils/leaveDateRange.js';
import { getLeaveClassExclusionsForRange, getUncancelledScheduleDateKeys } from '../utils/leaveAffectedClasses.js';
import { dedupeReplacementsBySchedule } from '../utils/leaveReplacements.js';
import { filterSchedulesActiveOnDate } from '../utils/activeSchedulesForDate.js';

import { buildTrainerAvailabilityForRange, WORK_DAY_START, WORK_DAY_END } from '../utils/trainerAvailability.js';
import { mergeRosterFilter } from '../utils/rosterFilter.js';
import { buildHourlyTrainerAvailability } from '../utils/hourlyTrainerAvailability.js';

const id = (value) => String(value?._id || value || '');
const trainerInfo = (trainer) => trainer ? { name: trainer.name, employeeId: trainer.employeeId || '' } : null;
const denied = () => ({ error: 'forbidden', message: 'You are not authorized to view this data.' });
const notFound = (kind) => ({ error: 'not_found', message: `No matching ${kind} record was found.` });
const MAX_RECORDS = 100;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const linkedId = (req) => id(req.user?.trainer);
const management = (req) => !req.impersonator && isAuthorizedRole(req.user?.role, MANAGEMENT_ROLES);
const fullAccess = (req) => !req.impersonator && FULL_ACCESS_ROLES.includes(req.user?.role);

const definitions = [
  ['get_my_timetable', 'Read my workload for a date or inclusive range. For this week use period=this_week; returns backend total and daily breakdown.', ['date', 'from', 'to', 'period', 'semester']],
  ['get_trainer_timetable', 'Read an authorized trainer timetable for a date or period. For this week use period=this_week. Never guess a trainer.', ['trainerName', 'employeeId', 'date', 'from', 'to', 'period', 'semester']],
  ['get_trainer_hours', 'Explain official hours for a date or inclusive range, including cancellations and holidays. For this week use period=this_week; totalHours covers the WHOLE returned period. Omit trainer identifiers for myself.', ['trainerName', 'employeeId', 'date', 'from', 'to', 'period', 'semester']],
  ['get_trainer_availability', 'Read scheduled free intervals and hour-by-hour available trainers on ANY IST date, including future dates. Includes leave, replacements, holidays and cancellations. Without trainer identifiers returns all permitted active roster trainers; otherwise one authorized trainer. Available means free for the entire time window, not physically present.', ['date', 'trainerName', 'employeeId', 'startTime', 'endTime'], ['date']],
  ['get_live_venues', 'Read today\'s scheduled trainer occupancy at the current IST time or HH:mm.', ['time']],
  ['get_leaves', 'Read only permitted leave records overlapping an inclusive date range.', ['from', 'to', 'status']],
  ['get_replacements', 'Read permitted class replacement coverage for one date; omit trainer identifiers for myself.', ['date', 'trainerName', 'employeeId']],
  ['get_special_classes', 'Read special classes overlapping a period. Requires management access.', ['from', 'to']],
  ['get_class_student_count', 'Read the active student count for a permitted class. Returns no student records.', ['department', 'section', 'semester'], ['department', 'section', 'semester']],
  ['get_topic_tracker', 'Read authorized daily topic-tracker sessions and class summaries.', ['date', 'trainerName', 'department', 'section', 'semester', 'subjectCode']],
  ['get_my_attendance', 'Read only my attendance and sanitized punch records over an inclusive period.', ['from', 'to']],
];

export const getAiToolDeclarations = (req) => definitions
  .filter(([name]) => !['get_trainer_timetable', 'get_special_classes', 'get_replacements'].includes(name) || management(req))
  .map(([name, description, fields, required = []]) => ({
    name, description,
    parameters: { type: 'OBJECT', properties: Object.fromEntries(fields.map((field) => [field, {
      type: 'STRING', description: field === 'period' ? 'today, this_week or last_week (Monday-Sunday IST). Do not combine with date/from/to.'
        : ['date', 'from', 'to'].includes(field) ? 'IST calendar date YYYY-MM-DD. Use date for one day OR from/to for an inclusive range, not both.' : field,
      ...(field === 'period' ? { enum: ['today', 'this_week', 'last_week'] } : {}),
    }])), required },
  }));

export const validateToolArguments = (name, args = {}, now = new Date()) => {
  const definition = definitions.find(([tool]) => tool === name);
  if (!definition || !args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Invalid tool arguments');
  const [, , fields, required = []] = definition;
  const cleaned = {};
  for (const [key, value] of Object.entries(args)) {
    if (!fields.includes(key) || typeof value !== 'string' || value.length > 120 || !value.trim()) throw new Error('Invalid tool arguments');
    cleaned[key] = value.trim();
    if (['date', 'from', 'to'].includes(key) && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !toAttendanceDateKey(value))) throw new Error('Invalid date');
  }
  if (required.some((key) => !cleaned[key])) throw new Error('Missing tool arguments');
  if (name === 'get_trainer_availability') {
    for (const field of ['startTime', 'endTime']) {
      if (cleaned[field] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(cleaned[field])) throw new Error('Invalid time');
    }
    cleaned.startTime ||= WORK_DAY_START;
    cleaned.endTime ||= WORK_DAY_END;
    if (cleaned.startTime < WORK_DAY_START || cleaned.endTime > WORK_DAY_END || cleaned.endTime <= cleaned.startTime) throw new Error('Use an interval within working hours');
  }
  if (cleaned.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(cleaned.time)) throw new Error('Invalid time');
  if (cleaned.semester && !/^(I|II|III|IV|V|VI|VII|VIII)$/.test(cleaned.semester)) throw new Error('Invalid semester');
  if (cleaned.status && !['pending', 'approved', 'rejected', 'cancelled'].includes(cleaned.status)) throw new Error('Invalid status');
  const today = getIstNowParts(now).dateKey;
  const hoursTool = ['get_my_timetable', 'get_trainer_timetable', 'get_trainer_hours'].includes(name);
  if (cleaned.period) {
    if (!['today', 'this_week', 'last_week'].includes(cleaned.period) || cleaned.date || cleaned.from || cleaned.to) throw new Error('Use one period or date range');
    if (cleaned.period === 'today') cleaned.date = today;
    else {
      const anchor = normalizeAttendanceDate(today);
      if (cleaned.period === 'last_week') anchor.setUTCDate(anchor.getUTCDate() - 7);
      const week = getWeekRangeForDate(anchor);
      cleaned.from = toAttendanceDateKey(week.start);
      cleaned.to = toAttendanceDateKey(week.end);
    }
  }
  if (hoursTool && cleaned.date && (cleaned.from || cleaned.to)) throw new Error('Use date or range, not both');
  if (fields.includes('date') && (!hoursTool || (!cleaned.from && !cleaned.to))) cleaned.date ||= today;
  if (fields.includes('from') && (!hoursTool || cleaned.from || cleaned.to)) {
    cleaned.from ||= cleaned.to || today;
    cleaned.to ||= cleaned.from;
    const days = (new Date(cleaned.to) - new Date(cleaned.from)) / 86400000;
    if (days < 0 || days > 30) throw new Error('Use an inclusive date range of at most 31 days');
  }
  return cleaned;
};

// Invoke only explicitly selected read controllers in-process, retaining req.user/impersonator.
// This adapter never passes frontend/model query objects or invokes routes over HTTP.
export const readController = async (controller, req, query = {}) => {
  let status = 200;
  let payload;
  await controller({ user: req.user, impersonator: req.impersonator, query, params: {} }, {
    status(code) { status = code; return this; },
    json(data) { payload = data; return this; },
  });
  if (status >= 400) return { error: status === 403 ? 'forbidden' : 'unavailable', message: 'The requested live data could not be retrieved.' };
  return payload;
};

const allowedTrainer = async (req, trainerId) => linkedId(req) === id(trainerId)
  || fullAccess(req)
  || (management(req) && isSubjectCoordinator(req.user) && await coordinatorCanAccessTrainer(req.user, trainerId));

export const resolveAiTrainer = async (req, args, deps = {}) => {
  const find = deps.findTrainers || (async (filter) => Trainer.find(excludeArchivedExternalTrainers(filter))
    .select('name employeeId scheduleTrainerCodes joiningDate').limit(11).lean());
  if (!args.employeeId && !args.trainerName) {
    if (!linkedId(req)) return notFound('linked trainer');
    const matches = await find({ _id: linkedId(req) });
    return matches[0] || notFound('trainer');
  }
  if (!management(req)) return denied();
  const filter = args.employeeId ? { employeeId: args.employeeId }
    : { name: { $regex: escapeRegex(args.trainerName), $options: 'i' } };
  const candidates = await find(filter);
  const permitted = [];
  for (const trainer of candidates) {
    if (await (deps.canAccessTrainer || allowedTrainer)(req, trainer._id)) permitted.push(trainer);
  }
  if (!permitted.length) return notFound('trainer');
  if (permitted.length > 1) return { error: 'ambiguous', message: 'Choose a trainer by employee ID.', candidates: permitted.slice(0, 10).map(trainerInfo) };
  if (args.employeeId && args.trainerName && permitted[0].name.toLowerCase() !== args.trainerName.toLowerCase()) return notFound('trainer');
  return permitted[0];
};

const compactSchedule = (schedule, subjects = new Map(), venues = new Map(), trainers = new Map()) => ({
  ...(schedule.date ? { date: schedule.date } : {}),
  ...(schedule.holidayName ? { holidayName: schedule.holidayName } : {}),
  day: schedule.day, startTime: schedule.startTime, endTime: schedule.endTime,
  department: schedule.department || '', section: schedule.section || '', semester: schedule.semester || '',
  subject: subjects.get(id(schedule.subject)) || schedule.subject?.name || schedule.subjectCode || '',
  subjectCode: schedule.subjectCode || '', venue: venues.get(id(schedule.venue)) || schedule.venue?.name || '',
  slot: schedule.slot || '', isSpecial: Boolean(schedule.isSpecial),
  specialType: schedule.specialType || '', specialReason: schedule.specialReason || '',
  includeInRtet: schedule.includeInRtet !== false,
  replacementFor: trainers.get(schedule.replacementForTrainerId) || schedule.replacementFor?.trainerName || null,
  replacement: schedule.replacement ? (schedule.replacement.isExternal
    ? { name: schedule.replacement.externalTrainerName, isExternal: true }
    : trainers.get(schedule.replacement.trainerId) || null) : null,
  kind: schedule.exclusion || (schedule.isReplacementAssignment ? 'replacement_assignment' : schedule.isSpecial ? 'special_class' : 'regular_class'),
});

const timetable = async (req, args, deps) => {
  const trainer = await resolveAiTrainer(req, args, deps);
  if (trainer.error) return trainer;
  const compute = deps.computeHours || computeClassHandlingHoursBatch;
  const from = args.from || args.date;
  const to = args.to || args.date;
  const dates = getAttendanceCalendarDates(from, to);
  const computed = await compute([trainer._id], dates, args.semester || null, [trainer], { includeDetails: true });
  const days = dates.map((day) => {
    const date = toAttendanceDateKey(day);
    const details = computed.get(`${id(trainer)}|${date}`);
    if (!details || !Number.isFinite(details.totalHours)) throw new Error('Incomplete hours calculation');
    return { date, ...details };
  });
  const details = {
    totalHours: Math.round(days.reduce((sum, day) => sum + day.totalHours, 0) * 10) / 10,
    schedules: days.flatMap((day) => day.schedules.map((schedule) => ({ ...schedule, date: day.date }))),
    excludedSchedules: days.flatMap((day) => day.excludedSchedules.map((schedule) => ({ ...schedule, date: day.date }))),
  };
  const records = [...details.schedules, ...details.excludedSchedules];
  const holidayNames = records.some((s) => s.exclusion === 'official_holiday')
    ? (deps.holidayNames || await loadOfficialHolidayMap(normalizeAttendanceDate(from), normalizeAttendanceDate(to))) : new Map();
  details.excludedSchedules = details.excludedSchedules.map((s) => ({ ...s, holidayName: holidayNames.get(s.date) || '' }));
  const subjects = deps.subjectNames || new Map((await Subject.find({ _id: { $in: [...new Set(records.map((s) => id(s.subject)).filter(Boolean))] } }).select('name').lean()).map((s) => [id(s), s.name]));
  const venues = deps.venueNames || new Map((await Venue.find({ _id: { $in: [...new Set(records.map((s) => id(s.venue)).filter(Boolean))] } }).select('name').lean()).map((v) => [id(v), v.name]));
  const replacementIds = [...new Set(records.flatMap((s) => [s.replacementForTrainerId, s.replacement?.trainerId]).filter(Boolean))];
  const trainers = deps.trainerNames || new Map((await Trainer.find({ _id: { $in: replacementIds } }).select('name employeeId').lean()).map((t) => [id(t), trainerInfo(t)]));
  return { ...(from === to ? { date: from } : {}), from, to, trainer: trainerInfo(trainer), totalHours: details.totalHours,
    days: days.map((day) => ({ date: day.date, totalHours: day.totalHours, ...(holidayNames.has(day.date) ? { holidayName: holidayNames.get(day.date) } : {}) })),
    calculation: 'TOMS attendance class-handling calculation; this is not an RTET total or proof of attendance.',
    schedules: details.schedules.slice(0, MAX_RECORDS).map((s) => compactSchedule(s, subjects, venues, trainers)),
    excludedSchedules: details.excludedSchedules.slice(0, MAX_RECORDS).map((s) => compactSchedule(s, subjects, venues, trainers)),
    truncated: details.schedules.length > MAX_RECORDS || details.excludedSchedules.length > MAX_RECORDS,
  };
};

const leaves = async (req, args, read) => {
  if (!fullAccess(req) && !linkedId(req)) return denied();
  const payload = await read(getLeaves, req, { status: args.status, page: '1', limit: '50' });
  if (payload.error) return payload;
  return { from: args.from, to: args.to,
    leaves: payload.leaves.filter((leave) => toAttendanceDateKey(leave.startDate) <= args.to && toAttendanceDateKey(leave.endDate) >= args.from)
      .map((leave) => ({ trainer: trainerInfo(leave.trainer), from: toAttendanceDateKey(leave.startDate), to: toAttendanceDateKey(leave.endDate), status: leave.status,
        scope: leave.scope, replacementNeeded: leave.replacementNeeded })),
    truncated: payload.pagination.total > 50,
    ...(payload.pagination.total > 50 ? { notice: 'Only the latest 50 authorized leaves were searched; this is not a complete period total.' } : {}),
  };
};

const replacements = async (req, args, deps) => {
  let trainer;
  if (args.trainerName || args.employeeId || !fullAccess(req)) {
    trainer = await resolveAiTrainer(req, args, deps);
    if (trainer.error) return trainer;
  }
  const filter = { status: 'approved', ...getLeaveOverlapFilter(args.date) };
  if (trainer) filter.$or = [{ trainer: trainer._id }, { 'replacements.replacementTrainer': trainer._id }];
  const docs = await Leave.find(filter).select('trainer startDate endDate replacements affectedSchedules')
    .populate('trainer', 'name employeeId').populate('replacements.replacementTrainer', 'name employeeId')
    .populate({ path: 'affectedSchedules', populate: [{ path: 'subject', select: 'name' }, { path: 'venue', select: 'name' }] })
    .limit(MAX_RECORDS + 1).lean();
  const { cancellationMap, holidayDateKeys } = await getLeaveClassExclusionsForRange(args.date, args.date);
  const rows = [];
  for (const leave of docs.slice(0, MAX_RECORDS)) {
    const active = await filterSchedulesActiveOnDate((leave.affectedSchedules || []).filter((s) => s && getUncancelledScheduleDateKeys(leave, s, cancellationMap, holidayDateKeys).includes(args.date)), args.date);
    for (const entry of dedupeReplacementsBySchedule(leave.replacements || [])) {
      if (trainer && id(leave.trainer) !== id(trainer) && id(entry.replacementTrainer) !== id(trainer)) continue;
      const schedule = active.find((s) => id(s) === id(entry.schedule));
      if (!schedule) continue;
      rows.push({ date: args.date, originalTrainer: trainerInfo(leave.trainer),
        replacementTrainer: entry.isExternal ? { name: entry.externalTrainerName || '', isExternal: true } : trainerInfo(entry.replacementTrainer),
        schedule: compactSchedule(schedule) });
    }
  }
  return { date: args.date, replacements: rows.slice(0, MAX_RECORDS), truncated: docs.length > MAX_RECORDS || rows.length > MAX_RECORDS };
};

const specialClasses = async (req, args, read) => {
  if (!management(req)) return denied();
  const payload = await read(getSpecialClasses, req, { from: args.from });
  if (payload.error) return payload;
  const records = payload.specialClasses.filter((s) => s.startDate <= args.to && s.endDate >= args.from);
  const [subjects, venues] = await Promise.all([
    Subject.find({ _id: { $in: records.map((s) => s.subjectId).filter(Boolean) } }).select('name').lean(),
    Venue.find({ _id: { $in: records.map((s) => s.venueId).filter(Boolean) } }).select('name').lean(),
  ]);
  const subjectNames = new Map(subjects.map((s) => [id(s), s.name]));
  const venueNames = new Map(venues.map((v) => [id(v), v.name]));
  return { from: args.from, to: args.to, specialClasses: records.slice(0, MAX_RECORDS).map((s) => ({
    trainer: s.trainerName, from: s.startDate, to: s.endDate, days: s.days,
    department: s.department, section: s.section, semester: s.semester,
    subject: subjectNames.get(s.subjectId) || s.subjectCode, subjectCode: s.subjectCode,
    venue: venueNames.get(s.venueId) || '', startTime: s.startTime, endTime: s.endTime,
    specialType: s.specialType, specialReason: s.reason, includeInRtet: s.includeInRtet,
  })), truncated: records.length > MAX_RECORDS || payload.specialClasses.length >= 500 };
};

const classCount = async (req, args, read) => {
  if (!fullAccess(req) && !isSubjectCoordinator(req.user) && !linkedId(req)) return denied();
  const payload = await read(getClasses, req, { semester: args.semester, status: 'active' });
  if (payload.error) return payload;
  const matches = payload.filter((cls) => cls.department.toLowerCase() === args.department.toLowerCase() && cls.section.toLowerCase() === args.section.toLowerCase());
  if (!matches.length) return notFound('authorized class');
  if (matches.length > 1) return { error: 'ambiguous', message: 'Multiple active classes match. Ask management to disambiguate the class.' };
  const cls = matches[0];
  return { department: cls.department, section: cls.section, semester: cls.currentSemester, activeStudentCount: cls.studentCount };
};

const topicTracker = async (req, args, read, deps) => {
  if (!fullAccess(req) && !linkedId(req) && !isSubjectCoordinator(req.user)) return denied();
  let trainerId;
  if (args.trainerName) {
    const trainer = await resolveAiTrainer(req, args, deps);
    if (trainer.error) return trainer;
    trainerId = id(trainer);
  } else if (!management(req)) trainerId = linkedId(req);
  const payload = await read(getTopicTrackerSessions, req, { date: args.date, trainerId });
  if (payload.error) return payload;
  // Resolve class filters against the same class-access controller, without exposing students.
  let allowedLabels;
  if (args.department || args.section || args.semester) {
    const classes = await read(getClasses, req, { semester: args.semester });
    if (classes.error) return classes;
    const matching = classes.filter((c) => (!args.department || c.department === args.department) && (!args.section || c.section === args.section));
    if (!matching.length) return notFound('authorized class');
    allowedLabels = matching.map((c) => `${c.department}, ${c.py ? `PY ${c.py} ` : ''}Sem ${c.currentSemester} - ${c.section}`);
  }
  const sessions = payload.sessions.filter((s) => (!args.subjectCode || s.subjectCode === args.subjectCode) && (!allowedLabels || allowedLabels.includes(s.branchYearSection)));
  const summary = await read(getTopicTrackerClassSummary, req, {});
  return { date: args.date, sessions: sessions.slice(0, MAX_RECORDS).map((s) => ({
    trainer: s.trainerName, originalTrainer: s.originalTrainerName, replacementTrainer: s.replacementTrainerName,
    class: s.branchYearSection, subject: s.courseName, subjectCode: s.subjectCode, venue: s.roomNo,
    startTime: s.sessionStartTime, endTime: s.sessionEndTime, durationHours: s.durationHrs,
    sessionStatus: s.sessionStatus, trackerStatus: s.trackerStatus, topicsCovered: s.topicModulesCovered,
  })), summary: summary.error ? { error: summary.error } : summary.subjects.filter((s) => !args.subjectCode || s.subjectCode === args.subjectCode)
    .slice(0, 20).map((s) => ({ subject: s.subjectName, subjectCode: s.subjectCode,
      classes: s.classes.filter((c) => (!trainerId || c.trainerId === trainerId) && (!allowedLabels || allowedLabels.includes(c.branchYearSection))).slice(0, 30)
        .map((c) => ({ trainer: c.trainerName, class: c.branchYearSection, coveragePercent: c.coveragePercent, remainingTrainingHours: c.remainingTrainingHours, closedSlots: c.closedSlots })) })),
    truncated: sessions.length > MAX_RECORDS || (!summary.error && (summary.subjects.length > 20 || summary.subjects.some((s) => s.classes.length > 30))),
  };
};

const attendance = async (req, args, read, deps) => {
  if (!linkedId(req)) return notFound('linked trainer');
  // Even management accounts with linked trainers get only their own private attendance.
  const ownReq = { user: { role: ROLES.TRAINER, trainer: req.user.trainer, _id: req.user._id }, impersonator: req.impersonator };
  const months = [...new Set([args.from.slice(0, 7), args.to.slice(0, 7)])];
  const records = [];
  for (const month of months) {
    const grid = await (deps.attendanceGrid || buildTrainerAttendanceGridPayload)({ month, semester: 'III', user: ownReq.user });
    const ownRow = grid.rows.find((row) => id(row.trainer) === linkedId(req));
    if (!ownRow) continue;
    for (const [date, cell] of Object.entries(ownRow.days)) {
      if (date < args.from || date > args.to) continue;
      records.push({ date, attendanceType: cell.attendanceType, oifNumber: cell.oifNumber, classHandlingHours: cell.classHandlingHours,
        mockPrepHours: cell.mockPrepHours, isOnLeave: cell.isOnLeave, isFuture: cell.isFuture });
    }
  }
  const punches = await read(getTrainerPunchInLogs, ownReq, { from: args.from, to: args.to, page: '1', limit: '50' });
  return { from: args.from, to: args.to, attendanceSemester: 'III', records,
    punches: punches.error ? { error: punches.error } : punches.logs.map((log) => ({ date: log.date, punchInAt: log.punchInAt, source: log.punchInSource })),
    truncated: !punches.error && punches.pagination.total > 50 };
};

const trainerAvailability = async (req, args, deps) => {
  let trainerIds;
  if (args.trainerName || args.employeeId || !management(req)) {
    const trainer = await resolveAiTrainer(req, args, deps);
    if (trainer.error) return trainer;
    trainerIds = [id(trainer)];
  } else {
    let scope = {};
    if (!fullAccess(req)) {
      scope = await buildTrainerFilterForCoordinatorSubjects(getCoordinatorSubjectIds(req.user));
    }
    scope = await mergeRosterFilter(scope, { rosterOnly: true });
    const trainers = await (deps.availabilityRoster || (async (filter) => Trainer.find(filter).select('_id').lean()))(scope);
    trainerIds = trainers.map(id);
  }
  const result = trainerIds.length ? await (deps.availability || buildTrainerAvailabilityForRange)({
    // Calendar strings preserve the requested date in both IST and UTC deployments.
    startDate: args.date, endDate: args.date, trainerIds,
    slotStart: args.startTime, slotEnd: args.endTime,
  }) : { trainers: [] };
  const permittedIds = new Set(trainerIds);
  return buildHourlyTrainerAvailability({ trainers: (result.trainers || []).filter((trainer) => permittedIds.has(id(trainer))) }, args, MAX_RECORDS);
};

export const executeAiTool = async (name, rawArgs, req, deps = {}) => {
  if (!req.user || !Object.values(ROLES).includes(req.user.role)) return denied();
  if (!getAiToolDeclarations(req).some((tool) => tool.name === name)) return denied();
  let args;
  try { args = validateToolArguments(name, rawArgs, deps.now); } catch {
    return { error: 'invalid_arguments', message: 'Use valid tool arguments, IST dates, and an inclusive range of at most 31 days.' };
  }
  const read = deps.read || readController;
  try {
    switch (name) {
      case 'get_my_timetable': return await timetable(req, args, deps);
      case 'get_trainer_timetable':
      case 'get_trainer_hours': return await timetable(req, args, deps);
      case 'get_leaves': return await leaves(req, args, read);
      case 'get_replacements': return await replacements(req, args, deps);
      case 'get_special_classes': return await specialClasses(req, args, read);
      case 'get_class_student_count': return await classCount(req, args, read);
      case 'get_topic_tracker': return await topicTracker(req, args, read, deps);
      case 'get_my_attendance': return await attendance(req, args, read, deps);
      case 'get_trainer_availability': return await trainerAvailability(req, args, deps);
      case 'get_live_venues': {
        const result = await (deps.liveVenues || buildLiveTrainerVenues)({ time: args.time, now: deps.now || new Date() });
        return { date: result.date, currentTime: result.currentTime, isLive: result.isLive,
          trainers: result.trainers.slice(0, MAX_RECORDS).map((row) => ({ trainer: row.name, employeeId: row.employeeId, status: row.status,
            venue: row.venue?.name || '', location: row.venue?.locationSummary || '',
            schedule: row.schedule ? compactSchedule(row.schedule) : null, replacementFor: row.replacedTrainerName || '' })),
          truncated: result.trainers.length > MAX_RECORDS };
      }
      default: return denied();
    }
  } catch {
    return { error: 'unavailable', message: 'The requested live data could not be retrieved. Do not invent an answer.' };
  }
};
