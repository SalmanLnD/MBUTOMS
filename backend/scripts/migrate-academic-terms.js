// Dry run by default. Apply only against a verified backup/restored rehearsal:
// node scripts/migrate-academic-terms.js --apply --confirm-initial-term
import 'dotenv/config';
import mongoose from 'mongoose';
import { readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import AcademicTerm from '../models/AcademicTerm.js';
import AcademicPublication from '../models/AcademicPublication.js';
import AcademicTermJob from '../models/AcademicTermJob.js';
import StudentIdentity from '../models/StudentIdentity.js';
import { getTermModelDefinitions, getTermRepositories } from '../utils/academicTermContext.js';

const apply = process.argv.includes('--apply');
const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const startDate = argument('start-date');
const endDate = argument('end-date');
if (apply && !process.argv.includes('--confirm-initial-term')) throw new Error('Apply requires --confirm-initial-term after reviewing the 2026-2027 Odd mapping and taking a backup.');
if (apply && (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || '') || Number.isNaN(new Date(startDate).getTime()) || Number.isNaN(new Date(endDate).getTime()) || new Date(startDate) > new Date(endDate))) throw new Error('Apply requires reviewed --start-date=YYYY-MM-DD and --end-date=YYYY-MM-DD.');
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
await mongoose.connect(process.env.MONGODB_URI);
try {
  for (const file of await readdir(new URL('../models/', import.meta.url))) if (file.endsWith('.js')) await import(`../models/${file}`);
  const db = mongoose.connection.db;
  const inventory = [];
  for (const [model, definition] of getTermModelDefinitions()) {
    const collection = db.collection(definition.collection);
    const count = await collection.countDocuments();
    const checksum = createHash('sha256');
    for await (const doc of collection.find().sort({ _id: 1 })) checksum.update(JSON.stringify(doc));
    inventory.push({ model, collection: definition.collection, count, sourceChecksum: checksum.digest('hex') });
  }
  const audit = {
    subjectYearLabels: await db.collection('subjects').distinct('academicYear'),
    reportMonths: await db.collection('student_monthly_test_reports').distinct('month'),
    studentSemesterLabels: await db.collection('students').distinct('semesterLabel'),
    evenSemesterStudents: await db.collection('students').countDocuments({ status: 'active', semesterLabel: { $in: ['II','IV','VI','VIII','2','4','6','8'] } }),
    duplicateRollNumbers: await db.collection('students').aggregate([{ $group: { _id: '$rollNumber', count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }]).toArray(),
    orphanedReports: await db.collection('student_monthly_test_reports').aggregate([{ $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 'identity' } }, { $match: { identity: { $size: 0 } } }, { $count: 'count' }]).toArray(),
  };
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', initialTerm: '2026-2027-odd', dates: { startDate, endDate }, inventory, audit }, null, 2));
  if (apply) {
    if (audit.evenSemesterStudents || audit.duplicateRollNumbers.length || audit.orphanedReports.length) throw new Error('Migration audit has invalid parity, duplicate identities or orphaned marks. Resolve before applying.');
    const published = await AcademicPublication.findById('current').lean();
    if (published) throw new Error('Already migrated. Refusing to overwrite published partitions. Run verification instead.');
    await AcademicTerm.createIndexes();
    await AcademicTermJob.createIndexes();
    await StudentIdentity.createIndexes();
    const term = await AcademicTerm.findOneAndUpdate({ key: '2026-2027-odd' }, { $setOnInsert: { academicYear: '2026-2027', parity: 'odd', lifecycle: 'current', storageKey: 'shared', startDate: new Date(startDate), endDate: new Date(`${endDate}T23:59:59.999Z`), calendarUrl: argument('calendar-url') || 'https://drive.google.com/drive/u/1/folders/1GvF_2ieWFGKaFfVvPTSaVG1bl87WQD3J' } }, { upsert: true, new: true });
    const repositories = await getTermRepositories(term);
    await AcademicTermJob.findOneAndUpdate({ key: 'migration:initial' }, { $set: { termId: term._id, kind: 'migration', status: 'running', manifest: inventory } }, { upsert: true });
    for (const row of inventory) {
      const source = db.collection(row.collection);
      const destination = repositories.models[row.model].collection;
      const operations = [];
      for await (const doc of source.find()) {
        operations.push({ replaceOne: { filter: { _id: doc._id }, replacement: { ...doc, termId: term._id }, upsert: true } });
        if (operations.length === 500) { await destination.bulkWrite(operations); operations.length = 0; }
      }
      if (operations.length) await destination.bulkWrite(operations);
      await repositories.models[row.model].createIndexes();
      const count = await destination.countDocuments();
      const checksum = createHash('sha256');
      for await (const doc of destination.find().sort({ _id: 1 })) { delete doc.termId; checksum.update(JSON.stringify(doc)); }
      if (count !== row.count || checksum.digest('hex') !== row.sourceChecksum) throw new Error(`Verification failed: ${row.model}`);
    }
    const identityBatch = [];
    for await (const student of db.collection('students').find()) {
      identityBatch.push({ updateOne: { filter: { _id: student._id }, update: { $setOnInsert: { rollNumber: student.rollNumber, name: student.name, email: student.email } }, upsert: true } });
      if (identityBatch.length === 500) { await StudentIdentity.bulkWrite(identityBatch); identityBatch.length = 0; }
    }
    if (identityBatch.length) await StudentIdentity.bulkWrite(identityBatch);
    if (repositories.models.AcademicUserAssignment) {
      for await (const user of db.collection('users').find({ $or: [{ 'coordinatorSubjects.0': { $exists: true } }, { 'evaluatorSubjects.0': { $exists: true } }] })) {
        await repositories.models.AcademicUserAssignment.collection.updateOne({ user: user._id }, { $setOnInsert: { user: user._id, coordinatorSubjects: user.coordinatorSubjects || [], evaluatorSubjects: user.evaluatorSubjects || [], termId: term._id } }, { upsert: true });
      }
    }
    for (const key of ['timetable_spreadsheet', 'timetable_export_api_key', 'topic_tracker_spreadsheet', 'topic_tracker_export_api_key', 'student_test_reports_spreadsheet', 'student_test_reports_export_api_key']) {
      const setting = await db.collection('app_settings').findOne({ key });
      if (setting) await db.collection('app_settings').updateOne({ key: `term:${term._id}:${key}` }, { $setOnInsert: { value: setting.value } }, { upsert: true });
    }
    // Publication is last; any interrupted copy can be rerun while disabled.
    await AcademicPublication.create({ _id: 'current', currentTermId: term._id, revision: 1 });
    await AcademicTermJob.updateOne({ key: 'migration:initial' }, { $set: { status: 'completed' } });
    console.log('Verified initial partition. Enable ACADEMIC_TERMS_ENABLED=true only on the reviewed deployment after the academic write freeze. Legacy collections were preserved.');
  }
} finally { await mongoose.disconnect(); }
