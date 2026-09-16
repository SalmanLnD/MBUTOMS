import test from 'node:test';
import assert from 'node:assert/strict';
import { isExternalTrainerArchived, excludeArchivedExternalTrainers } from '../../utils/externalTrainerArchive.js';
import { isTrainerVisibleInUi, mergeAttendanceExportTrainerFilter } from '../../utils/trainerEmployment.js';
import User from '../../models/User.js';

test('external tenure includes its last day and archives at midnight IST', () => {
  const trainer = { createdAsBulkReplacement: true, replacementAttendanceTo: new Date('2026-09-12') };
  assert.equal(isExternalTrainerArchived(trainer, new Date('2026-09-12T18:29:59Z')), false);
  assert.equal(isExternalTrainerArchived(trainer, new Date('2026-09-12T18:30:00Z')), true);
  assert.equal(isTrainerVisibleInUi(trainer, new Date('2026-09-16')), false);
  assert.equal(isExternalTrainerArchived({ ...trainer, createdAsBulkReplacement: false }, new Date('2026-09-16')), false);
  assert.equal(isExternalTrainerArchived({ createdAsBulkReplacement: true }, new Date('2026-09-16')), false);
  assert.equal(isExternalTrainerArchived({ ...trainer, replacementAttendanceTo: new Date('2026-09-20') }, new Date('2026-09-16')), false);
});

test('archive query uses the IST date, preserves caller constraints and does not enter historical export filters', async (t) => {
  const base = { status: 'active' };
  const filter = excludeArchivedExternalTrainers(base, new Date('2026-09-12T18:30:00Z'));
  assert.deepEqual(filter.$and[0], base);
  assert.deepEqual(filter.$and[1].$nor[0], { createdAsBulkReplacement: true,
    replacementAttendanceTo: { $ne: null, $lt: new Date('2026-09-13') } });
  assert.deepEqual(base, { status: 'active' });
  t.mock.method(User, 'find', () => ({ select() { return this; }, lean: async () => [] }));
  assert.equal(JSON.stringify(await mergeAttendanceExportTrainerFilter()).includes('replacementAttendanceTo'), false);
});
