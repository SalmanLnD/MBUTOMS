import fs from 'node:fs';
const edit=(f,fn)=>fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')));
let db=fs.readFileSync('backend/config/db.js','utf8').replace(/\r\n/g,'\n');
let startup=db.slice(0,db.indexOf('const getCache')).replace("import mongoose from 'mongoose';\n",'');
startup+=db.slice(db.indexOf('/** Lightweight role sync'),db.indexOf('const runStartupTasks'));
startup+='export const runStartupTasks = async () => {\n  await runEssentialStartup();\n  await runFullStartupTasks();\n};\n';
fs.writeFileSync('backend/config/startupTasks.js',startup);
fs.writeFileSync('backend/config/db.js',`import mongoose from 'mongoose';

const getCache = () => (globalThis._mongooseCache ||= { promise: null, startupPromise: null });

export const connectDB = async ({ runStartup = false } = {}) => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured');
  const cache = getCache();
  if (!cache.promise) {
    cache.promise = mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10, minPoolSize: 0, autoCreate: false,
      serverSelectionTimeoutMS: 10_000, waitQueueTimeoutMS: 10_000,
    }).catch((error) => { cache.promise = null; throw error; });
  }
  const connection = await cache.promise;
  if (runStartup && process.env.RUN_STARTUP_SYNC === 'true') {
    cache.startupPromise ||= import('./startupTasks.js').then(({ runStartupTasks }) => runStartupTasks())
      .catch((error) => { cache.startupPromise = null; throw error; });
    await cache.startupPromise;
  }
  return connection;
};
export default connectDB;
`);
edit('backend/utils/timetableBoard.js',s=>{
  s="import { buildSubjectStartDateMap, isScheduleWithinSubjectDates } from './subjectStartDate.js';\nimport { getLeaveOverlapFilter } from './leaveDateRange.js';\n"+s;
  s=s.replace('const [ownedSchedules, leaves, canceledScheduleIds]', 'const [ownedSchedules, leaves, canceledScheduleIds, subjectDates]');
  s=s.replace('      startDate: { $lte: ref },\n      endDate: { $gte: ref },','      ...getLeaveOverlapFilter(ref),');
  s=s.replace('    getCanceledScheduleIdsForDate(ref),','    getCanceledScheduleIdsForDate(ref),\n    buildSubjectStartDateMap(),');
  s=s.replace('  ownedSchedules.forEach((schedule) => {','  ownedSchedules.forEach((schedule) => {\n    if (!isScheduleWithinSubjectDates(schedule, referenceDate, subjectDates)) return;');
  s=s.replace('        if (!schedule) return;','        if (!schedule || !isScheduleWithinSubjectDates(schedule, referenceDate, subjectDates)) return;');
  return s;
});
edit('backend/utils/timetableExport.js',s=>{
  s="import { filterSchedulesActiveOnDate } from './activeSchedulesForDate.js';\n"+s;
  return s.replace('const allSchedules = await Schedule.find().lean();', 'const allSchedules = await filterSchedulesActiveOnDate(await Schedule.find().lean(), new Date());');
});
edit('backend/controllers/scheduleController.js',s=>{
  s="import { filterSchedulesActiveOnDate } from '../utils/activeSchedulesForDate.js';\n"+s;
  return s.replace('  res.json(schedules);\n};\n\nexport const getScheduleById', '  res.json(await filterSchedulesActiveOnDate(schedules, referenceDate));\n};\n\nexport const getScheduleById');
});
edit('backend/utils/attendanceGridCache.js',s=>s.replace('setCachedAttendanceGrid = (key, data)', 'setCachedAttendanceGrid = (key, data, revision = getDataRevision())').replace('revision: getDataRevision()','revision'));
edit('backend/controllers/trainerAttendanceController.js',s=>{
  s="import { getDataRevision } from '../utils/dataRevision.js';\n"+s;
  s=s.replace('  const today = getAttendanceToday();','  const revision = getDataRevision();\n  const today = getAttendanceToday();');
  return s.replace('setCachedAttendanceGrid(cacheKey, payload)', 'setCachedAttendanceGrid(cacheKey, payload, revision)');
});
for(const file of ['backend/scripts/maintain-data.mjs','backend/scripts/profile-reports.mjs']) edit(file,s=>s.replace('autoIndex: false,','autoCreate: false, autoIndex: false,'));
