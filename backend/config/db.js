import mongoose from 'mongoose';
import { ensureReferenceData } from '../utils/seedReferenceData.js';
import {
  migrateSubjectSchoolsAndDepartments,
  migrateSubjectSlotTimings,
  migrateSubjectSlotProfiles,
} from '../controllers/subjectController.js';
import { syncIdsaTrainersAndSubject } from '../utils/syncIdsaData.js';
import { syncPstpTrainersAndSubject } from '../utils/syncPstpData.js';
import { syncAllTrainerSubjectLinks } from '../utils/syncTrainerSubjectLinks.js';
import { migrateSubjectTopicsFromCatalog } from '../utils/migrateSubjectTopicsFromCatalog.js';
import { syncSubjectCoordinators } from '../utils/syncSubjectCoordinators.js';
import { syncEvaluators } from '../utils/syncEvaluators.js';
import { migrateClassesFromSchedules } from '../utils/migrateClassesFromSchedules.js';
import { repairClassIndexesAndPy } from '../utils/repairClassIndexesAndPy.js';
import { ensureOfficialHolidays } from '../utils/officialHolidays.js';

const getCache = () => {
  if (!globalThis._mongooseCache) {
    globalThis._mongooseCache = { conn: null, promise: null, startupDone: false, roleSyncDone: false };
  }
  return globalThis._mongooseCache;
};

/** Lightweight role sync for serverless (Vercel skips full startup). */
const runRoleSync = async () => {
  const coordinatorSync = await syncSubjectCoordinators();
  const evaluatorSync = await syncEvaluators();
  if (coordinatorSync.updated) {
    console.log(`Subject coordinator sync: ${coordinatorSync.updated} coordinator account(s) updated`);
  }
  if (evaluatorSync.updated) {
    console.log(`Evaluator sync: ${evaluatorSync.updated} evaluator account(s) updated`);
  }
};

const runEssentialStartup = async () => {
  const counts = await ensureReferenceData();
  const subjectTopicsMigration = await migrateSubjectTopicsFromCatalog();
  const coordinatorSync = await syncSubjectCoordinators();
  const evaluatorSync = await syncEvaluators();
  const officialHolidays = await ensureOfficialHolidays();
  console.log(
    `Reference data ready: ${counts.schoolCount} schools, ${counts.semesterCount} semesters, ${counts.departmentCount} departments`
  );
  if (officialHolidays.length) {
    console.log(`Official holidays: ${officialHolidays.map((row) => `${row.date} ${row.name} (${row.status})`).join('; ')}`);
  }
  if (subjectTopicsMigration.updatedCount) {
    console.log(`Subject topics migration: ${subjectTopicsMigration.updatedCount} subject(s) seeded from catalogs`);
  }
  if (coordinatorSync.updated) {
    console.log(`Subject coordinator sync: ${coordinatorSync.updated} coordinator account(s) updated`);
  }
  if (evaluatorSync.updated) {
    console.log(`Evaluator sync: ${evaluatorSync.updated} evaluator account(s) updated`);
  }
  return counts;
};

const runFullStartupTasks = async () => {
  await migrateSubjectSchoolsAndDepartments();
  await migrateSubjectSlotTimings();
  const slotProfileMigration = await migrateSubjectSlotProfiles();
  console.log(`Subject slot profile migration: ${slotProfileMigration.updated} subject(s) updated`);
  const idsaSync = await syncIdsaTrainersAndSubject();
  const pstpSync = await syncPstpTrainersAndSubject();
  const subjectLinkSync = await syncAllTrainerSubjectLinks();
  const classMigration = await migrateClassesFromSchedules();
  const classPyRepair = await repairClassIndexesAndPy();

  console.log(`IDSA sync: ${idsaSync.trainersUpdated} trainers, subject ${idsaSync.subjectCode}, ${idsaSync.schedulesTagged} schedule slots tagged`);
  console.log(`PSTP sync: ${pstpSync.trainersUpdated} trainers, subject ${pstpSync.subjectCode}, ${pstpSync.schedulesTagged} schedule slots tagged`);
  console.log(`Trainer-subject link sync: ${subjectLinkSync.trainersUpdated} trainer record(s), ${subjectLinkSync.subjectsUpdated} subject record(s) updated`);
  console.log(`Class migration: ${classMigration.created} created, ${classMigration.updated} updated, ${classMigration.skipped} unchanged (${classMigration.total} distinct from timetables), PY sync ${classMigration.pySync?.updated || 0} updated`);
  console.log(`Class PY repair: ${classPyRepair.updated} updated, ${classPyRepair.skipped} unchanged`);
};

const runStartupTasks = async () => {
  await runEssentialStartup();
  if (process.env.RUN_STARTUP_SYNC === 'true') {
    await runFullStartupTasks();
  }
};

export const connectDB = async ({ runStartup = false } = {}) => {
  const cache = getCache();

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(process.env.MONGODB_URI).then((conn) => {
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return conn;
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }

  const shouldRunStartup = runStartup && !cache.startupDone;

  if (shouldRunStartup) {
    await runStartupTasks();
    cache.startupDone = true;
    cache.roleSyncDone = true;
  } else if (!cache.roleSyncDone) {
    // Production/serverless: still promote coordinators/evaluators once per instance.
    cache.roleSyncDone = true;
    await runRoleSync();
  }

  return cache.conn;
};

export default connectDB;
