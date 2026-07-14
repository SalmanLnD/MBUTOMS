import mongoose from 'mongoose';
import { ensureReferenceData } from '../utils/seedReferenceData.js';
import { migrateSubjectSchoolsAndDepartments, migrateSubjectSlotTimings, migrateSubjectSlotProfiles } from '../controllers/subjectController.js';
import { syncIdsaTrainersAndSubject } from '../utils/syncIdsaData.js';
import { syncPstpTrainersAndSubject } from '../utils/syncPstpData.js';
import { repairReplacementSchedules } from '../utils/repairReplacementSchedules.js';
import { migrateTrainerEmailOptional } from '../utils/migrateTrainerEmailOptional.js';
import { migrateTrainerStatusRestore } from '../utils/migrateTrainerStatusRestore.js';
import { clearEmployeeTimetableSchedules } from '../utils/clearEmployeeTimetableSchedules.js';
import { syncAllTrainerSubjectLinks } from '../utils/syncTrainerSubjectLinks.js';
import { migrateSubjectCommercialFields } from '../utils/migrateSubjectCommercialFields.js';
import { migrateSubjectAcademicYear } from '../utils/migrateSubjectAcademicYear.js';
import { migrateSubjectPracticePortalUrls } from '../utils/migrateSubjectPracticePortalUrls.js';
import { migrateSubjectTopicsFromCatalog } from '../utils/migrateSubjectTopicsFromCatalog.js';
import { removeAllPedhData } from '../scripts/remove-all-pedh-data.mjs';
import { syncSubjectCoordinators } from '../utils/syncSubjectCoordinators.js';
import { syncLrreVSemesterTimetable } from '../utils/syncLrreVSemesterTimetable.js';
import { repairMisplacedLrreVSemesterSlots } from '../utils/repairMisplacedLrreVSemesterSlots.js';
import { migrateClassesFromSchedules } from '../utils/migrateClassesFromSchedules.js';
import { repairClassIndexesAndPy } from '../utils/repairClassIndexesAndPy.js';
import { repairTrainerScheduleCodeLinks } from '../utils/repairTrainerScheduleCodeLinks.js';

const getCache = () => {
  if (!globalThis._mongooseCache) {
    globalThis._mongooseCache = { conn: null, promise: null, startupDone: false };
  }
  return globalThis._mongooseCache;
};

const runEssentialStartup = async () => {
  const counts = await ensureReferenceData();
  const academicYearMigration = await migrateSubjectAcademicYear();
  const practicePortalMigration = await migrateSubjectPracticePortalUrls();
  const subjectTopicsMigration = await migrateSubjectTopicsFromCatalog();
  const pedhCleanup = await removeAllPedhData();
  const coordinatorSync = await syncSubjectCoordinators();
  console.log(
    `Reference data ready: ${counts.schoolCount} schools, ${counts.semesterCount} semesters, ${counts.departmentCount} departments`
  );
  if (academicYearMigration.updatedCount) {
    console.log(`Subject academic year migration: ${academicYearMigration.updatedCount} subject(s) set to ${academicYearMigration.academicYear}`);
  }
  if (practicePortalMigration.updatedCount) {
    console.log(`Subject practice portal migration: ${practicePortalMigration.updatedCount} subject(s) updated`);
  }
  if (subjectTopicsMigration.updatedCount) {
    console.log(`Subject topics migration: ${subjectTopicsMigration.updatedCount} subject(s) seeded from catalogs`);
  }
  if (pedhCleanup.removedSchedules || pedhCleanup.removedTrainers || pedhCleanup.removedSubject) {
    console.log(
      `PEDH cleanup: ${pedhCleanup.removedSchedules} schedule slot(s), ${pedhCleanup.removedTrainers} placeholder trainer(s), subject removed=${pedhCleanup.removedSubject}`
    );
  }
  if (coordinatorSync.updated) {
    console.log(`Subject coordinator sync: ${coordinatorSync.updated} coordinator account(s) updated`);
  }
  return counts;
};

const runFullStartupTasks = async () => {
  await migrateSubjectSchoolsAndDepartments();
  await migrateSubjectSlotTimings();
  const slotProfileMigration = await migrateSubjectSlotProfiles();
  console.log(`Subject slot profile migration: ${slotProfileMigration.updated} subject(s) updated`);
  const commercialFieldsMigration = await migrateSubjectCommercialFields();
  const idsaSync = await syncIdsaTrainersAndSubject();
  const pstpSync = await syncPstpTrainersAndSubject();
  const repair = await repairReplacementSchedules();
  const emailMigration = await migrateTrainerEmailOptional();
  const statusMigration = await migrateTrainerStatusRestore();
  const timetableCleanup = await clearEmployeeTimetableSchedules();
  const subjectLinkSync = await syncAllTrainerSubjectLinks();
  const lrreVSemesterSync = await syncLrreVSemesterTimetable();
  const lrreSemesterRepair = await repairMisplacedLrreVSemesterSlots();
  const classMigration = await migrateClassesFromSchedules();
  const classPyRepair = await repairClassIndexesAndPy();
  const scheduleCodeRepair = await repairTrainerScheduleCodeLinks();

  console.log(`Subject commercial fields migration: ${commercialFieldsMigration.updatedCount} subject(s) backfilled (start date ${commercialFieldsMigration.defaultStartDate})`);
  console.log(`IDSA sync: ${idsaSync.trainersUpdated} trainers, subject ${idsaSync.subjectCode}, ${idsaSync.schedulesTagged} schedule slots tagged`);
  console.log(`PSTP sync: ${pstpSync.trainersUpdated} trainers, subject ${pstpSync.subjectCode}, ${pstpSync.schedulesTagged} schedule slots tagged`);
  console.log(`Replacement repair: ${repair.migrated} assignment(s) migrated to leave records, ${repair.restored} schedule slot(s) restored to original trainers`);
  console.log(`Trainer email migration: ${emailMigration.unsetCount} trainer(s) cleared of empty email values`);
  console.log(`Trainer status migration: ${statusMigration.restoredCount} trainer(s) set to active`);
  console.log(`Timetable cleanup: ${timetableCleanup.deletedCount} schedule slot(s) removed for unmapped employee IDs`);
  console.log(`Trainer-subject link sync: ${subjectLinkSync.trainersUpdated} trainer record(s), ${subjectLinkSync.subjectsUpdated} subject record(s) updated`);
  console.log(`LRRE V Semester timetable sync: ${lrreVSemesterSync.upsertedCount} slot(s) upserted, ${lrreVSemesterSync.updatedCount} updated`);
  console.log(`LRRE misplaced semester repair: ${lrreSemesterRepair.repairedCount} slot(s) moved from III to V`);
  console.log(`Class migration: ${classMigration.created} created, ${classMigration.updated} updated, ${classMigration.skipped} unchanged (${classMigration.total} distinct from timetables), PY sync ${classMigration.pySync?.updated || 0} updated`);
  console.log(`Class PY repair: ${classPyRepair.updated} updated, ${classPyRepair.skipped} unchanged`);
  console.log(`Trainer schedule code repair: ${scheduleCodeRepair.updated} trainer record(s) linked to legacy timetable codes`);
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
  }

  return cache.conn;
};

export default connectDB;
