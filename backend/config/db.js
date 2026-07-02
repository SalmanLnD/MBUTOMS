import mongoose from 'mongoose';
import { ensureReferenceData } from '../utils/seedReferenceData.js';
import { migrateSubjectSchoolsAndDepartments, migrateSubjectSlotTimings } from '../controllers/subjectController.js';
import { syncIdsaTrainersAndSubject } from '../utils/syncIdsaData.js';
import { syncPedhTrainersAndSubject } from '../utils/syncPedhData.js';
import { repairReplacementSchedules } from '../utils/repairReplacementSchedules.js';
import { migrateTrainerEmailOptional } from '../utils/migrateTrainerEmailOptional.js';
import { migrateTrainerStatusRestore } from '../utils/migrateTrainerStatusRestore.js';
import { clearEmployeeTimetableSchedules } from '../utils/clearEmployeeTimetableSchedules.js';
import { syncAllTrainerSubjectLinks } from '../utils/syncTrainerSubjectLinks.js';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    const counts = await ensureReferenceData();
    await migrateSubjectSchoolsAndDepartments();
    await migrateSubjectSlotTimings();
    const idsaSync = await syncIdsaTrainersAndSubject();
    const pedhSync = await syncPedhTrainersAndSubject();
    const repair = await repairReplacementSchedules();
    const emailMigration = await migrateTrainerEmailOptional();
    const statusMigration = await migrateTrainerStatusRestore();
    const timetableCleanup = await clearEmployeeTimetableSchedules();
    const subjectLinkSync = await syncAllTrainerSubjectLinks();
    console.log(`Reference data ready: ${counts.schoolCount} schools, ${counts.semesterCount} semesters, ${counts.departmentCount} departments`);
    console.log(`IDSA sync: ${idsaSync.trainersUpdated} trainers, subject ${idsaSync.subjectCode}, ${idsaSync.schedulesTagged} schedule slots tagged`);
    console.log(`PEDH sync: ${pedhSync.trainersUpdated} trainers, subject ${pedhSync.subjectCode}, ${pedhSync.schedulesTagged} schedule slots tagged, Sai Priya ${pedhSync.saiPriya?.pedhSlots || 0} PEDH / ${pedhSync.saiPriya?.dsapSlots || 0} DSAP`);
    console.log(`Replacement repair: ${repair.migrated} assignment(s) migrated to leave records, ${repair.restored} schedule slot(s) restored to original trainers`);
    console.log(`Trainer email migration: ${emailMigration.unsetCount} trainer(s) cleared of empty email values`);
    console.log(`Trainer status migration: ${statusMigration.restoredCount} trainer(s) set to active`);
    console.log(`Timetable cleanup: ${timetableCleanup.deletedCount} schedule slot(s) removed for unmapped employee IDs`);
    console.log(`Trainer-subject link sync: ${subjectLinkSync.trainersUpdated} trainer record(s), ${subjectLinkSync.subjectsUpdated} subject record(s) updated`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
