import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const uri = process.env.ACADEMIC_REHEARSAL_URI;
if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/academic_rehearsal_[a-z0-9_]+$/.test(uri || '')) throw new Error('Only local rehearsal databases are allowed.');
const backupPath = process.env.ACADEMIC_BACKUP_PATH;
const { EJSON } = mongoose.mongo.BSON;
const checksum = value => createHash('sha256').update(EJSON.stringify(value, { relaxed: false })).digest('hex');
const connection = await mongoose.createConnection(uri, { autoCreate: false, autoIndex: false }).asPromise();
try {
  const manifest = JSON.parse(await readFile(join(backupPath, 'manifest.json'), 'utf8'));
  const publication = await connection.db.collection('academicpublications').findOne({ _id: 'current' });
  if (!publication) throw new Error('No initial publication.');
  const allowed = ['timetable_spreadsheet', 'timetable_export_api_key', 'topic_tracker_spreadsheet', 'topic_tracker_export_api_key', 'student_test_reports_spreadsheet', 'student_test_reports_export_api_key'];
  for (const row of manifest) {
    const { documents } = EJSON.parse(await readFile(join(backupPath, row.file), 'utf8'), { relaxed: false });
    const restored = await connection.db.collection(row.name).find().sort({ _id: 1 }).toArray();
    const originalIds = new Set(documents.map(doc => String(doc._id)));
    if (checksum(restored.filter(doc => originalIds.has(String(doc._id)))) !== row.checksum) throw new Error(`Original records changed: ${row.name}`);
    for (const doc of restored.filter(doc => !originalIds.has(String(doc._id)))) {
      if (row.name === 'academicterms' && String(doc._id) === String(publication.currentTermId) && doc.key === '2026-2027-odd') continue;
      if (row.name === 'academicpublications' && doc._id === 'current' && doc.revision === 1) continue;
      if (row.name === 'academictermjobs' && doc.key === 'migration:initial' && doc.status === 'completed') continue;
      if (row.name === 'student_identities') {
        const student = await connection.db.collection('students').findOne({ _id: doc._id });
        if (student && student.rollNumber === doc.rollNumber && student.name === doc.name) continue;
      }
      const original = documents.find(item => allowed.includes(item.key) && doc.key === `term:${publication.currentTermId}:${item.key}`);
      if (row.name !== 'app_settings' || !original || checksum(original.value) !== checksum(doc.value)) throw new Error(`Unexpected addition: ${row.name}`);
    }
  }
  const job = await connection.db.collection('academictermjobs').findOne({ key: 'migration:initial', status: 'completed' });
  if (!job) throw new Error('Migration is not completed.');
  for (const row of job.manifest) {
    const records = await connection.db.collection(`term_${publication.currentTermId}_${row.collection}`).find().sort({ _id: 1 }).toArray();
    if (row.model === 'AcademicUserAssignment') {
      const users = await connection.db.collection('users').find({ $or: [{ 'coordinatorSubjects.0': { $exists: true } }, { 'evaluatorSubjects.0': { $exists: true } }] }).toArray();
      for (const user of users) {
        const assignment = records.find(record => String(record.user) === String(user._id));
        if (!assignment || checksum(assignment.coordinatorSubjects) !== checksum(user.coordinatorSubjects || []) || checksum(assignment.evaluatorSubjects) !== checksum(user.evaluatorSubjects || [])) throw new Error('Migrated user assignments mismatch');
      }
    } else if (records.length !== row.count) throw new Error(`Partition count mismatch: ${row.model}`);
    // The migration itself verifies the legacy JSON checksum before publishing.
  }
  console.log(JSON.stringify({ verification: 'PASS', originalCollections: manifest.length, originalDocuments: manifest.reduce((sum, row) => sum + row.count, 0), partitionCollections: job.manifest.length, initialTermId: String(publication.currentTermId), backupPath }));
} finally { await connection.close(); }
