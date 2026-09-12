import fs from 'node:fs';
const edit = (file, fn) => { const s = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'); fs.writeFileSync(file, fn(s)); };
const replace = (s, a, b) => { if (!s.includes(a)) throw new Error(`Missing replacement: ${a.slice(0,100)}`); return s.replace(a,b); };

for (const file of ['backend/utils/attendanceTracking.js','backend/utils/leaveDateRange.js']) {
  edit(file, s => {
    const marker = file.includes('attendanceTracking') ? 'export const toAttendanceDateKey' : '/**';
    const pos = s.indexOf(marker);
    s = s.slice(0,pos) + "const operationalDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });\n\n" + s.slice(pos);
    return s.replace(/new Intl\.DateTimeFormat\('en-CA', \{[\s\S]*?\}\)\.format\(date\)/g, 'operationalDateFormatter.format(date)');
  });
}
edit('backend/utils/subjectStartDate.js', s => {
  s = s.replace("import { normalizeDate } from './scheduleHelpers.js';", "import { normalizeAttendanceDate as normalizeDate } from './attendanceTracking.js';\nimport { createAsyncReportCache } from './asyncReportCache.js';\nimport { invalidateDerivedData } from './dataRevision.js';");
  const start = s.indexOf('let subjectStartDateCache');
  const end = s.indexOf('export const resolveScheduleSubjectStartDate');
  s = s.slice(0,start) + `const readSubjectMap = createAsyncReportCache({ ttlMs: 60_000, maxEntries: 1 });
export const buildSubjectStartDateMap = () => readSubjectMap('subjects', async () => {
  const subjects = await Subject.find().select('_id code name startDate endDate').lean();
  const byId = new Map();
  const byCode = new Map();
  for (const subject of subjects) {
    const range = {
      startDate: subject.startDate ? normalizeDate(subject.startDate) : DEFAULT_SUBJECT_START_DATE,
      endDate: resolveSubjectEndDate(subject) || DEFAULT_SUBJECT_END_DATE,
    };
    byId.set(String(subject._id), range);
    if (subject.code) byCode.set(subject.code.trim(), range);
  }
  return { byId, byCode };
});
export const clearSubjectStartDateCache = invalidateDerivedData;

export const getScheduleSubjectRange = (schedule, map) => {
  const id = schedule.subject?._id?.toString() || schedule.subject?.toString();
  const code = String(schedule.subjectCode || schedule.subject?.code || '').trim();
  const meta = map.byId.get(id) || map.byCode.get(code);
  return {
    startDate: meta?.startDate || DEFAULT_SUBJECT_START_DATE,
    endDate: meta?.endDate || DEFAULT_SUBJECT_END_DATE,
  };
};

// All callers use inclusive operational calendar-day boundaries.
export const isScheduleWithinSubjectDates = (schedule, referenceDate, map) => {
  const ref = normalizeDate(referenceDate);
  const { startDate, endDate } = getScheduleSubjectRange(schedule, map);
  return ref >= startDate && ref <= endDate;
};

` + s.slice(end);
  s = s.slice(0, s.indexOf('export const isScheduleActiveOnDate')) + `export const isScheduleActiveOnDate = async (schedule, referenceDate) =>
  isScheduleWithinSubjectDates(schedule, referenceDate, await buildSubjectStartDateMap());
`;
  return s;
});
edit('backend/utils/activeSchedulesForDate.js',s => {
  s = s.replace('  DEFAULT_SUBJECT_START_DATE,','  isScheduleWithinSubjectDates,');
  const start = s.indexOf('  const { byId, byCode }');
  const end = s.indexOf('\n}\n',start);
  return s.slice(0,start) + `  const map = await buildSubjectStartDateMap();
  return schedules.filter((schedule) => isScheduleWithinSubjectDates(schedule, referenceDate, map));` + s.slice(end);
});
for (const file of ['backend/utils/trainerAvailability.js','backend/utils/trainerClassHoursBatch.js']) {
  edit(file,s => {
    s = "import { isScheduleWithinSubjectDates } from './subjectStartDate.js';\n" + s;
    const start = s.indexOf('const resolveStartDate =');
    const end = s.indexOf('\n};',s.indexOf('const isActiveOnDate =',start)) + 3;
    s = s.slice(0,start) + 'const isActiveOnDate = isScheduleWithinSubjectDates;\n' + s.slice(end);
    if (file.includes('Batch')) s=s.replace("const SCHEDULE_FIELDS = 'day startTime endTime trainerCode semester subject subjectCode';", "const SCHEDULE_FIELDS = 'day startTime endTime trainerCode semester subject subjectCode department section';");
    return s;
  });
}
edit('backend/utils/attendanceOifRules.js',s => s.replace('return value.startsWith(IT_OIF_CODE);', "return value.startsWith(IT_OIF_CODE) || value === CA26421_OIF_CODE || value.startsWith(`${CA26421_OIF_CODE} `);") );
edit('backend/models/Trainer.js',s=>s.replace("enum: ['active', 'resigned']", "enum: ['active', 'resigned', 'relocated']"));
edit('backend/middleware/exportGuard.js',s=>s.replace('const release = () => { active = false; };','let released = false;\n  const release = () => { if (!released) { active = false; released = true; } };'));
for (const file of fs.readdirSync('backend/middleware').filter(f=>f.endsWith('ExportAuth.js'))) {
  edit(`backend/middleware/${file}`,s=>{
    s="import { asyncHandler } from './asyncHandler.js';\nimport { exportGuard } from './exportGuard.js';\n"+s;
    s=s.replace('= async (req, res, next) => {','= asyncHandler(async (req, res, next) => {');
    s=s.replace('  next();','  return exportGuard(req, res, next);');
    return s.replace(/\};\s*$/, '});\n');
  });
}
edit('backend/app.js',s=>{
  s=s.replace("import { computeClassHandlingHoursBatch } from './utils/trainerClassHoursBatch.js';", "import { invalidateAfterWrite } from './utils/dataRevision.js';");
  const start=s.indexOf('// Temporary debug endpoint');
  const end=s.indexOf('app.use(notFound);',start);
  s=s.slice(0,start)+s.slice(end);
  return s.replace("app.use('/api/auth'", "app.use(invalidateAfterWrite);\n\napp.use('/api/auth'");
});
edit('backend/utils/attendanceGridCache.js',s=>{
  s="import { getDataRevision } from './dataRevision.js';\n"+s;
  s=s.replace("      : 'all';", "      : isTrainerLikeRole(user?.role) ? `unlinked:${user?._id || 'none'}` : 'all';");
  s=s.replace('`${month}|${semester}|${scope}|${todayKey}`', '`${month}|${semester}|${user?.role || \'export\'}|${scope}|${todayKey}`');
  s=s.replace('if (Date.now() - entry.cachedAt > CACHE_TTL_MS)', 'if (entry.revision !== getDataRevision() || Date.now() - entry.cachedAt > CACHE_TTL_MS)');
  s=s.replace('cache.set(key, { data, cachedAt: Date.now() });', 'if (cache.size >= 32) cache.delete(cache.keys().next().value);\n  cache.set(key, { data, cachedAt: Date.now(), revision: getDataRevision() });');
  return s;
});
edit('backend/services/attendanceSheetsService.js',s=>{
  s="import { createAsyncReportCache } from '../utils/asyncReportCache.js';\nimport { invalidateDerivedData } from '../utils/dataRevision.js';\n"+s;
  const start=s.indexOf('const EXPORT_CACHE_MS');
  const end=s.indexOf('const getExportKey',start);
  s=s.slice(0,start)+`const readAttendanceExport = createAsyncReportCache({ ttlMs: 300_000, maxEntries: 1 });
export const clearAttendanceExportCache = invalidateDerivedData;

`+s.slice(end);
  return s.slice(0,s.indexOf('export const exportTrainerAttendance ='))+`export const exportTrainerAttendance = () =>
  readAttendanceExport('attendance', buildTrainerAttendanceExportPayload);
`;
});
edit('backend/config/db.js',s=>{
  s=s.replace("  await runEssentialStartup();\n  if (process.env.RUN_STARTUP_SYNC === 'true') {\n    await runFullStartupTasks();\n  }", "  // Migrations and cleanup are maintenance operations, not server boot work.\n  if (process.env.RUN_STARTUP_SYNC === 'true') {\n    await runEssentialStartup();\n    await runFullStartupTasks();\n  } else {\n    await runRoleSync();\n  }");
  s=s.replace('mongoose.connect(process.env.MONGODB_URI)', 'mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 10, minPoolSize: 0, serverSelectionTimeoutMS: 10_000, waitQueueTimeoutMS: 10_000 })');
  s=s.replace('    cache.roleSyncDone = true;\n    await runRoleSync();','    await runRoleSync();\n    cache.roleSyncDone = true;');
  return s;
});
edit('frontend/src/services/api.js',s=>s.replace('      && !config.skipRetry', "      && ['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())\n      && !config.skipRetry"));
edit('frontend/src/context/AuthContext.jsx',s=>{
  s="import { invalidateTrainerAttendanceGridCache } from '../services/attendanceService.js';\n"+s;
  s=s.replace('    resetSessionExpiredState();\n    const userData', '    invalidateTrainerAttendanceGridCache();\n    resetSessionExpiredState();\n    const userData');
  return s.replace('  const logout = useCallback(() => {','  const logout = useCallback(() => {\n    invalidateTrainerAttendanceGridCache();');
});
edit('frontend/src/services/attendanceService.js',s=>s.replace('`${JSON.stringify(params)}|${toAttendanceDateKey()}`', '`${localStorage.getItem(\'toms_token\') || \'anonymous\'}|${JSON.stringify(params)}|${toAttendanceDateKey(new Date())}`').replace('`${JSON.stringify(params)}|${toAttendanceDateKey()}`', '`${localStorage.getItem(\'toms_token\') || \'anonymous\'}|${JSON.stringify(params)}|${toAttendanceDateKey(new Date())}`'));
edit('frontend/src/utils/helpers.js',s=>s.replace('Server is reconnecting. Wait a moment and try again.', 'The server is taking too long to respond. Please try again.'));
edit('.github/workflows/ci.yml',s=>s.replace('run: node --check server.js','run: npm test'));

// Prevent overlapping executions within each deployed Apps Script project.
for(const file of fs.readdirSync('backend/templates').filter(f=>f.endsWith('.gs'))) {
  edit(`backend/templates/${file}`,s=>{
    const match=s.match(/function (sync\w+)\(\) \{/);
    if(!match) return s;
    const name=match[1];
    s=s.replace(match[0],`function ${name}() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try { return ${name}Unlocked(); } finally { lock.releaseLock(); }
}

function ${name}Unlocked() {`);
    return s.replaceAll('.everyMinutes(5)', '.everyMinutes(15)');
  });
}
