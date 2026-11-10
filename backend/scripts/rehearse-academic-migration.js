// Read the configured source database; write only a new local rehearsal database.
import 'dotenv/config';
import mongoose from 'mongoose';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const { EJSON } = mongoose.mongo.BSON;
const encode = value => EJSON.stringify(value, { relaxed: false });
const checksum = value => createHash('sha256').update(encode(value)).digest('hex');
const destinationUri = process.env.ACADEMIC_REHEARSAL_URI;
if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/academic_rehearsal_[a-z0-9_]+$/.test(destinationUri || '')) throw new Error('Supply a new local academic_rehearsal_ database URI.');
const backupPath = await mkdtemp(join(tmpdir(), 'toms-academic-backup-'));
const source = await mongoose.createConnection(process.env.MONGODB_URI, { autoCreate: false, autoIndex: false }).asPromise();
const destination = await mongoose.createConnection(destinationUri, { autoCreate: false, autoIndex: false }).asPromise();
try {
  if ((await destination.db.listCollections().toArray()).length) throw new Error('Rehearsal database must be empty.');
  const collections = (await source.db.listCollections({ type: 'collection' }).toArray()).filter(row => !row.name.startsWith('system.'));
  const manifest = [];
  for (const { name } of collections) {
    const documents = await source.db.collection(name).find().sort({ _id: 1 }).toArray();
    const indexes = await source.db.collection(name).indexes();
    const file = `${manifest.length}.ejson`;
    await writeFile(join(backupPath, file), encode({ name, documents, indexes }));
    manifest.push({ name, file, count: documents.length, checksum: checksum(documents) });
  }
  // Detect concurrent source changes rather than claim a consistent snapshot.
  for (const row of manifest) {
    const documents = await source.db.collection(row.name).find().sort({ _id: 1 }).toArray();
    if (checksum(documents) !== row.checksum) throw new Error(`Source changed during backup: ${row.name}. Retry during a quiet window.`);
  }
  await writeFile(join(backupPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
  for (const row of manifest) {
    const { documents, indexes } = EJSON.parse(await readFile(join(backupPath, row.file), 'utf8'), { relaxed: false });
    const collection = await destination.db.createCollection(row.name);
    if (documents.length) await collection.insertMany(documents);
    for (const { key, name, v, ns, ...options } of indexes) if (name !== '_id_') await collection.createIndex(key, { ...options, name });
    if (checksum(await collection.find().sort({ _id: 1 }).toArray()) !== row.checksum) throw new Error(`Restore checksum mismatch: ${row.name}`);
  }
  console.log(JSON.stringify({ backupPath, restoredCollections: manifest.length, restoredDocuments: manifest.reduce((sum, row) => sum + row.count, 0), checksumsVerified: true }));
  const migration = spawnSync(process.execPath, ['scripts/migrate-academic-terms.js', '--apply', '--confirm-initial-term', '--start-date=2026-07-12', '--end-date=2026-12-06'], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, MONGODB_URI: destinationUri, ACADEMIC_TERMS_ENABLED: 'false' }, encoding: 'utf8', timeout: 180000,
  });
  await writeFile(join(backupPath, 'migration.log'), `${migration.stdout || ''}\n${migration.stderr || ''}`);
  if (migration.status !== 0) throw new Error(`Rehearsal migration failed; inspect ${join(backupPath, 'migration.log')}`);
  const publication = await destination.db.collection('academicpublications').findOne({ _id: 'current' });
  if (!publication) throw new Error('Migration did not publish initial term.');
  for (const row of manifest) {
    const { documents } = EJSON.parse(await readFile(join(backupPath, row.file), 'utf8'), { relaxed: false });
    const collection = destination.db.collection(row.name);
    const restored = await collection.find({ _id: { $in: documents.map(doc => doc._id) } }).sort({ _id: 1 }).toArray();
    if (checksum(restored) !== row.checksum) throw new Error(`Legacy/shared records changed: ${row.name}`);
    const added = await collection.find({ _id: { $nin: documents.map(doc => doc._id) } }).toArray();
    const allowed = ['timetable_spreadsheet', 'timetable_export_api_key', 'topic_tracker_spreadsheet', 'topic_tracker_export_api_key', 'student_test_reports_spreadsheet', 'student_test_reports_export_api_key'];
    for (const doc of added) {
      const original = documents.find(item => allowed.includes(item.key) && doc.key === `term:${publication.currentTermId}:${item.key}`);
      if (row.name !== 'app_settings' || !original || checksum(original.value) !== checksum(doc.value)) throw new Error(`Unexpected migrated addition: ${row.name}`);
    }
  }
  console.log(JSON.stringify({ rehearsal: 'PASS', initialTermId: String(publication.currentTermId), legacyAndSharedChecksumsUnchanged: true, backupPath }));
} finally {
  await source.close();
  await destination.close();
}
