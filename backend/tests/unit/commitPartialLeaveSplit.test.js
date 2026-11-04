import test from 'node:test';
import assert from 'node:assert/strict';
import { commitPartialLeaveSplit } from '../../utils/commitPartialLeaveSplit.js';

const source = () => ({
  _id: 'original', trainer: 'roja', status: 'approved', __v: 2,
  startDate: new Date('2026-11-01'), endDate: new Date('2026-11-10'),
  updatedAt: new Date('2026-11-04T10:00:00Z'),
  replacements: [{ schedule: 'schedule-1' }], affectedSchedules: ['schedule-1'],
});
const retained = () => [
  { trainer: 'roja', status: 'approved', startDate: new Date('2026-11-01'), endDate: new Date('2026-11-03') },
  { trainer: 'roja', status: 'approved', startDate: new Date('2026-11-07'), endDate: new Date('2026-11-10') },
];

// A transactional store with snapshots, rollback, and retry on the trainer write.
// Tests fail if retained ranges escape the transaction or a changed source is used.
const database = ({ original = source(), failInsert = false } = {}) => {
  let committed = [structuredClone(original)];
  let holder = null;
  let retries = 0;
  let inserts = 0;
  const Trainer = {
    async updateOne(filter, update, { session, timestamps }) {
      assert.equal(filter._id, 'roja');
      assert.deepEqual(update, { $inc: { __v: 1 } });
      assert.equal(timestamps, false);
      if (holder) {
        const error = new Error('Write conflict');
        error.transient = true;
        throw error;
      }
      holder = session;
      session.rows = structuredClone(committed);
      return { matchedCount: 1 };
    },
  };
  const Leave = {
    db: {
      async transaction(callback) {
        for (;;) {
          const session = {};
          try {
            const result = await callback(session);
            committed = session.rows;
            return result;
          } catch (error) {
            if (!error.transient) throw error;
            retries++;
            await new Promise(resolve => setImmediate(resolve));
          } finally {
            if (holder === session) holder = null;
          }
        }
      },
    },
    async updateOne(filter, update, { session, runValidators }) {
      assert.equal(holder, session, 'trainer write must precede the source claim');
      assert.equal(runValidators, true);
      const row = session.rows.find(item => Object.entries(filter).every(([key, expected]) => {
        if (expected?.$exists === false) return item[key] === undefined;
        if (expected instanceof Date) return item[key]?.getTime() === expected.getTime();
        return item[key] === expected;
      }));
      if (!row) return { matchedCount: 0 };
      Object.assign(row, structuredClone(update.$set));
      row.__v = (row.__v ?? 0) + update.$inc.__v;
      return { matchedCount: 1 };
    },
    async create(records, { session }) {
      assert.equal(holder, session);
      inserts++;
      // Deliberately stage one insert before throwing to exercise rollback.
      session.rows.push({ _id: 'before', ...structuredClone(records[0]) });
      if (failInsert) throw new Error('Second retained range failed');
      await new Promise(resolve => setImmediate(resolve));
      session.rows.push({ _id: 'after', ...structuredClone(records[1]) });
      return session.rows.slice(-2);
    },
  };
  return {
    get rows() { return committed; },
    get retries() { return retries; },
    get inserts() { return inserts; },
    split(snapshot = source()) {
      return commitPartialLeaveSplit({ Leave, Trainer, source: snapshot, records: retained() });
    },
  };
};

test('concurrent partial cancellations keep exactly one pair of retained ranges', async () => {
  const db = database();
  const results = await Promise.allSettled([db.split(), db.split()]);
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  const duplicate = results.find(row => row.status === 'rejected');
  assert.equal(duplicate.reason.statusCode, 409);
  assert.match(duplicate.reason.message, /leave changed/);
  assert.ok(db.retries > 0);
  assert.equal(db.inserts, 1);
  assert.equal(db.rows.length, 3);
  assert.equal(db.rows[0].status, 'cancelled');
  assert.deepEqual(db.rows[0].replacements, []);
  assert.deepEqual(db.rows.slice(1).map(row => [row.startDate.toISOString(), row.endDate.toISOString()]), [
    ['2026-11-01T00:00:00.000Z', '2026-11-03T00:00:00.000Z'],
    ['2026-11-07T00:00:00.000Z', '2026-11-10T00:00:00.000Z'],
  ]);
});

test('failed retained-range creation rolls back both source cancellation and inserted siblings', async () => {
  const db = database({ failInsert: true });
  await assert.rejects(db.split(), /Second retained range failed/);
  assert.deepEqual(db.rows, [source()]);
});

test('a source changed since it was read cannot be split or emit a successful result', async () => {
  for (const change of [
    { status: 'cancelled' }, { status: 'rejected' }, { __v: 3 },
    { startDate: new Date('2026-11-02') }, { endDate: new Date('2026-11-09') },
    { updatedAt: new Date('2026-11-04T10:00:01Z') },
  ]) {
    const original = { ...source(), ...change };
    const db = database({ original });
    await assert.rejects(db.split(), error => error.statusCode === 409);
    assert.equal(db.inserts, 0);
    assert.deepEqual(db.rows, [original]);
  }
});

test('success returns committed records and leaves notification snapshot mutation to the caller', async () => {
  const snapshot = source();
  const db = database();
  const { createdRecords, cancellation } = await db.split(snapshot);
  assert.equal(createdRecords.length, 2);
  assert.equal(cancellation.status, 'cancelled');
  assert.deepEqual(cancellation.bulkReplacement, {
    groupId: '', fromDate: null, toDate: null, replacementTrainer: null,
    assignedAt: null, assignedBy: null,
  });
  assert.deepEqual(snapshot, source());
});

test('historical source without a version is claimed once and gains a version', async () => {
  const original = source();
  delete original.__v;
  const db = database({ original });
  await db.split(original);
  assert.equal(db.rows[0].__v, 1);
  await assert.rejects(db.split(original), error => error.statusCode === 409);
  assert.equal(db.rows.length, 3);
});
