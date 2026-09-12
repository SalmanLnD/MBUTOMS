import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeAttendanceDate } from '../utils/attendanceTracking.js';
import { resolveSubjectEndDate } from '../utils/subjectStartDate.js';

dotenv.config();
const apply = process.argv.includes('--apply');
const plans = [];
const add = (collection, row, changes) => {
  const before = {};
  const set = {};
  for (const [key, value] of Object.entries(changes)) {
    const old = row[key];
    if (JSON.stringify(old) === JSON.stringify(value)) continue;
    before[key] = old === undefined ? { $exists: false } : old;
    set[key] = value;
  }
  if (Object.keys(set).length) plans.push({ collection, id: row._id, before, set });
};

try {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured');
  await mongoose.connect(process.env.MONGODB_URI, {
    autoCreate: false, autoIndex: false, maxPoolSize: 3, serverSelectionTimeoutMS: 10_000,
  });
  const db = mongoose.connection.db;
  const subjects = await db.collection('subjects').find({}, { projection: { code: 1, name: 1, startDate: 1, endDate: 1 } }).toArray();
  const schedules = await db.collection('schedules').find({}, { projection: { trainerCode: 1, subject: 1, subjectCode: 1, department: 1, section: 1, semester: 1, day: 1, startTime: 1, endTime: 1 } }).toArray();
  const byCode = new Map(subjects.map((s) => [String(s.code || '').trim(), s]));
  const byId = new Map(subjects.map((s) => [String(s._id), s]));
  let invalidRanges = 0;
  let unresolvedSubjects = 0;
  for (const subject of subjects) {
    const startDate = normalizeAttendanceDate(subject.startDate);
    const endDate = resolveSubjectEndDate(subject);
    if (!Number.isFinite(startDate.getTime()) || (endDate && (!Number.isFinite(endDate.getTime()) || endDate < startDate))) {
      invalidRanges += 1;
      continue;
    }
    add('subjects', subject, { startDate, ...(endDate ? { endDate } : {}) });
  }
  for (const row of schedules) {
    const subject = byId.get(String(row.subject)) || byCode.get(String(row.subjectCode || '').trim());
    if (!subject) unresolvedSubjects += 1;
    add('schedules', row, {
      trainerCode: String(row.trainerCode || '').trim(),
      subjectCode: subject?.code || String(row.subjectCode || '').trim(),
      ...(subject ? { subject: subject._id } : {}),
    });
  }
  const duplicates = await db.collection('topic_tracker_entries').aggregate([
    { $group: { _id: { schedule: '$schedule', day: { $dateToString: { date: '$date', format: '%Y-%m-%d', timezone: 'Asia/Kolkata' } } }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }, { $count: 'groups' },
  ], { maxTimeMS: 10_000 }).toArray();
  const summary = { database: db.databaseName, mode: apply ? 'apply' : 'audit',
    subjects: subjects.length, schedules: schedules.length,
    repairs: plans.reduce((acc, p) => { acc[p.collection] = (acc[p.collection] || 0) + 1; return acc; }, {}),
    invalidSubjectRanges: invalidRanges, unresolvedScheduleSubjects: unresolvedSubjects,
    duplicateTrackerDays: duplicates[0]?.groups || 0 };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) console.log(JSON.stringify({ subjectDateRepairs: plans.filter(p => p.collection === 'subjects').map(p => ({
    code: byId.get(String(p.id))?.code, before: p.before, after: p.set,
  })) }, null, 2));
  if (apply && plans.length) {
    // Preserve original values BEFORE a transaction; compare every touched field
    // so a concurrent edit aborts the entire cleanup instead of being overwritten.
    const dir = path.resolve('secrets/maintenance');
    await fs.mkdir(dir, { recursive: true });
    const backup = path.join(dir, `repair-${Date.now()}.json`);
    await fs.writeFile(backup, JSON.stringify({ database: db.databaseName, plans }, null, 2), { flag: 'wx' });
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const plan of plans) {
          const result = await db.collection(plan.collection).updateOne(
            { _id: plan.id, ...plan.before }, { $set: plan.set }, { session });
          if (result.matchedCount !== 1) throw new Error('Data changed during cleanup; transaction cancelled. Run the audit again.');
        }
      });
    } finally { await session.endSession(); }
    console.log(JSON.stringify({ applied: plans.length, backup }));
  }
} catch (error) {
  // Avoid echoing connection strings or credentials in error objects.
  console.error(`Maintenance failed (${error.code || error.name}). ${error.name === 'MongoServerSelectionError' ? 'Database connection unavailable.' : 'No successful cleanup is claimed; inspect the error locally.'}`);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
