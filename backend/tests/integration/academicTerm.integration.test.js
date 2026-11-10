import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';

// Run only against an explicitly supplied disposable local MongoDB. No .env URI
// is read or used by this integration test.
const uri = process.env.ACADEMIC_TEST_MONGO_URI;
test('semester migration boundary, publication, history and isolated URI routing', { skip: !uri, timeout: 90000 }, async t => {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\//, 'Use a disposable local MongoDB');
  process.env.MONGODB_URI = `${uri}academic_term_integration_${Date.now()}`;
  process.env.ACADEMIC_TERMS_ENABLED = 'true';
  process.env.JWT_SECRET = 'academic-integration-test-only';
  const { default: app } = await import('../../app.js');
  const { default: AcademicTerm } = await import('../../models/AcademicTerm.js');
  const { default: Publication } = await import('../../models/AcademicPublication.js');
  const { default: User } = await import('../../models/User.js');
  const { default: Trainer } = await import('../../models/Trainer.js');
  const { default: Leave } = await import('../../models/Leave.js');
  const { default: AppSetting } = await import('../../models/AppSetting.js');
  const { getTermRepositories } = await import('../../utils/academicTermContext.js');
  const { SESSION_APP_VERSION } = await import('../../utils/sessionVersion.js');
  await mongoose.connect(process.env.MONGODB_URI);
  const odd = await AcademicTerm.create({ academicYear: '2026-2027', parity: 'odd', key: '2026-2027-odd', lifecycle: 'current', startDate: '2026-07-01', endDate: '2026-12-31', calendarUrl: 'https://example.test/odd' });
  const even = await AcademicTerm.create({ academicYear: '2026-2027', parity: 'even', key: '2026-2027-even', startDate: '2027-01-01', endDate: '2027-05-31', calendarUrl: 'https://example.test/even', programDurations: { CSE: 8 } });
  await Publication.create({ _id: 'current', currentTermId: odd._id, revision: 1 });
  const admin = await User.create({ name: 'Admin', email: 'admin@example.test', password: 'testing123', role: 'admin' });
  const trainer = await Trainer.create({ name: 'Trainer', employeeId: 'TERM001' });
  const trainerUser = await User.create({ name: 'Trainer', email: 'trainer@example.test', password: 'testing123', role: 'trainer', trainer: trainer._id });
  const token = user => jwt.sign({ id: user._id, sv: 1, av: SESSION_APP_VERSION }, process.env.JWT_SECRET);
  const oddStore = await getTermRepositories(odd);
  const evenStore = await getTermRepositories(even);
  const studentId = new mongoose.Types.ObjectId(), subjectId = new mongoose.Types.ObjectId(), scheduleId = new mongoose.Types.ObjectId();
  await oddStore.models.Student.collection.insertOne({ _id: studentId, termId: odd._id, rollNumber: 'TEST001', name: 'Student', branch: 'CSE', sectionLabel: 'A', semesterLabel: 'III', py: 2029, status: 'active' });
  await oddStore.models.Subject.collection.insertOne({ _id: subjectId, termId: odd._id, name: 'Odd subject', code: 'TEST', trainerEligible: [trainer._id] });
  await oddStore.models.Schedule.collection.insertOne({ _id: scheduleId, termId: odd._id, trainerCode: trainer.employeeId, day: 'Monday', department: 'CSE', section: 'A', semester: 'III', startTime: '09:00', endTime: '10:00', subject: subjectId });
  await oddStore.models.ClassGroup.collection.insertOne({ _id: new mongoose.Types.ObjectId(), termId: odd._id, department: 'CSE', section: 'A', currentSemester: 'III', py: 2029, status: 'active' });
  await oddStore.models.StudentMonthlyTestReport.collection.insertOne({ _id: new mongoose.Types.ObjectId(), termId: odd._id, student: studentId, subject: subjectId, month: '2026-09', department: 'CSE', section: 'A', semester: 'III', marksObtained: 0, maxMarks: 10, attendance: 'P' });
  await Leave.collection.insertOne({ _id: new mongoose.Types.ObjectId(), termId: odd._id, trainer: trainer._id, startDate: new Date('2026-09-07'), endDate: new Date('2026-09-07'), status: 'approved', affectedSchedules: [scheduleId] });
  await AppSetting.create({ key: `term:${odd._id}:topic_tracker_export_api_key`, value: 'odd-secret' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (path, { user = admin, term, revision = 1, method = 'GET', body, headers = {} } = {}) => {
    const result = await fetch(`${base}${path}`, { method, headers: { ...(user ? { Authorization: `Bearer ${token(user)}` } : {}), 'Content-Type': 'application/json', 'X-Academic-Revision': String(revision), ...(term ? { 'X-Academic-Term': String(term._id) } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: result.status, data: await result.json() };
  };
  try {
    await t.test('personal draft view isolates roster and does not publish', async () => {
      assert.equal((await request('/students', { term: even })).data.pagination.total, 0);
      assert.equal(String((await Publication.findById('current')).currentTermId), String(odd._id));
      assert.equal((await request('/students', { user: trainerUser, term: even })).status, 403);
      assert.equal((await request('/students', { user: null, term: even })).status, 403);
    });
    await t.test('term models populate teaching and shared references through correct stores', async () => {
      const slot = await oddStore.models.Schedule.findById(scheduleId).populate('subject').lean();
      assert.equal(slot.subject.name, 'Odd subject');
      const history = await Leave.findOne({ termId: odd._id }).populate('affectedSchedules').lean();
      assert.equal(history.affectedSchedules[0].semester, 'III');
    });
    await t.test('bulk department transfer keeps report history', async () => {
      const transfer = await request('/students/bulk/import-batch', { method: 'POST', term: odd, body: { updateExisting: true, rows: [{ rowNumber: 2, payload: { rollNumber: 'TEST001', name: 'Student', branch: 'ECE', sectionLabel: 'B' } }] } });
      assert.equal(transfer.status, 200, JSON.stringify(transfer.data));
      const history = await request(`/student-test-reports/student/${studentId}/history`, { term: odd });
      assert.equal(history.status, 200, JSON.stringify(history.data));
      assert.equal(history.data.reports[0].marksObtained, 0);
      assert.equal(history.data.reports[0].department, 'CSE');
      // Restore placement so promotion rules configured for CSE apply.
      await oddStore.models.Student.collection.updateOne({ _id: studentId }, { $set: { branch: 'CSE', sectionLabel: 'A' } });
    });
    await t.test('prepare and publish promote once while preserving source and rejecting stale writes', async () => {
      // An interrupted first preparation copied a student subsequently removed
      // from the source. A retry must recover and remove that generated row.
      const removedId = new mongoose.Types.ObjectId();
      const partial = { _id: removedId, termId: even._id, rollNumber: 'REMOVED', name: 'Removed', semesterLabel: 'IV', status: 'active', promotionSourceTermId: odd._id };
      partial.promotionSnapshotChecksum = createHash('sha256').update(JSON.stringify(partial)).digest('hex');
      await evenStore.models.Student.collection.insertOne(partial);
      let prepared = await request(`/academic-terms/${even._id}/prepare`, { method: 'POST', body: { expectedRevision: 1 } });
      assert.equal(prepared.status, 200, JSON.stringify(prepared.data));
      assert.equal(await evenStore.models.Student.findById(removedId).lean(), null);
      assert.equal((await evenStore.models.Student.findById(studentId).lean()).semesterLabel, 'IV');
      assert.equal((await oddStore.models.Student.findById(studentId).lean()).semesterLabel, 'III');
      prepared = await request(`/academic-terms/${even._id}/prepare`, { method: 'POST', body: { expectedRevision: 1 } });
      assert.equal(prepared.status, 200, JSON.stringify(prepared.data));
      const published = await request(`/academic-terms/${even._id}/publish`, { method: 'POST', body: { expectedRevision: 1 } });
      assert.equal(published.status, 200, JSON.stringify(published.data));
      const repeated = await request(`/academic-terms/${even._id}/publish`, { method: 'POST', revision: 2, body: { expectedRevision: 1 } });
      assert.equal(repeated.status, 200, JSON.stringify(repeated.data));
      assert.equal((await Publication.findById('current')).revision, 2);
      const current = await request('/students', { revision: 2 });
      assert.equal(current.data.students[0].semesterLabel, 'IV');
      assert.equal(await evenStore.models.StudentMonthlyTestReport.countDocuments(), 0);
      const stale = await request(`/students/${studentId}`, { method: 'PUT', revision: 1, body: { name: 'Stale edit' } });
      assert.equal(stale.status, 409, JSON.stringify(stale.data));
      assert.equal(stale.data.code, 'ACADEMIC_TERM_STALE');
      const archived = await request(`/students/${studentId}`, { method: 'PUT', term: odd, revision: 2, body: { name: 'Archive edit' } });
      assert.equal(archived.status, 403, JSON.stringify(archived.data));
      const old = await request('/students', { term: odd, revision: 2 });
      assert.equal(old.data.students[0].semesterLabel, 'III');
    });
    await t.test('operational leave references survive publication and export credentials are term bound', async () => {
      const history = await Leave.findOne({ termId: odd._id }).populate({ path: 'affectedSchedules', populate: { path: 'subject' } }).lean();
      assert.equal(history.affectedSchedules[0].subject.name, 'Odd subject');
      const badExport = await request(`/topic-tracker/export?termId=${even._id}`, { user: null, headers: { 'X-Sheets-Key': 'odd-secret' } });
      assert.equal(badExport.status, 401);
      assert.equal(await Leave.countDocuments(), 1);
      assert.equal(await Trainer.countDocuments(), 1);
    });
    await t.test('a partition can use a separate database URI without cross database populate', async () => {
      process.env.ACADEMIC_DB_TEST_STORE = `${uri}academic_term_secondary_${Date.now()}`;
      const moved = await getTermRepositories({ ...even.toObject(), storageKey: 'TEST_STORE', routingRevision: 1 });
      const docs = await evenStore.models.Student.collection.find().toArray();
      await moved.models.Student.collection.insertMany(docs);
      assert.equal(String((await moved.models.Student.findById(studentId).lean())._id), String(studentId));
      assert.notEqual(moved.connection.name, evenStore.connection.name);
      await moved.connection.dropDatabase();
      await moved.connection.close();
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
