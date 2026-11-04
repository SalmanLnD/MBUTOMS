import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeaveWithoutOverlap } from '../../utils/createLeaveWithoutOverlap.js';

const date = value => new Date(`${value}T00:00:00.000Z`);
const request = (values = {}) => ({
  trainer: 'roja', startDate: date('2026-11-04'), endDate: date('2026-11-06'),
  reason: 'Personal leave', requestType: 'leave', scope: 'full_day', ...values,
});

// Model transaction retries and snapshots, rather than merely counting find/create
// calls. Omitting the first trainer write makes the parallel-request test fail.
const database = (initial = []) => {
  const rows = initial.map(row => ({ ...row }));
  const heldTrainers = new Map();
  let writes = 0;
  let retries = 0;
  const Trainer = {
    async updateOne(filter, update, options) {
      assert.deepEqual(update, { $inc: { __v: 1 } });
      assert.equal(options.timestamps, false);
      const { session } = options;
      assert.equal(session.readStarted, false, 'trainer write must happen before snapshot reads');
      if (filter._id === 'missing') return { matchedCount: 0 };
      if (heldTrainers.has(filter._id)) {
        const error = new Error('Write conflict');
        error.transient = true;
        throw error;
      }
      heldTrainers.set(filter._id, session);
      session.trainer = filter._id;
      session.snapshot = rows.map(row => ({ ...row }));
      return { matchedCount: 1 };
    },
  };
  const Leave = {
    db: {
      async transaction(callback) {
        for (;;) {
          const session = { readStarted: false, pending: [], snapshot: rows.map(row => ({ ...row })) };
          try {
            const result = await callback(session);
            rows.push(...session.pending);
            return result;
          } catch (error) {
            if (!error.transient) throw error;
            retries++;
            await new Promise(resolve => setImmediate(resolve));
          } finally {
            if (heldTrainers.get(session.trainer) === session) heldTrainers.delete(session.trainer);
          }
        }
      },
    },
    find(filter) {
      return {
        session(session) {
          session.readStarted = true;
          return {
            async lean() {
              return session.snapshot.filter(row => row.trainer === filter.trainer
                && filter.status.$in.includes(row.status)
                && row.startDate < filter.startDate.$lt
                && row.endDate >= filter.endDate.$gte);
            },
          };
        },
      };
    },
    async create(values, { session }) {
      writes++;
      const created = values.map(value => ({ _id: `leave-${writes}`, status: 'pending', ...value }));
      session.pending.push(...created);
      await new Promise(resolve => setImmediate(resolve));
      return created;
    },
  };
  return {
    rows,
    get writes() { return writes; },
    get retries() { return retries; },
    create(data = request(), findLegacySchedules = async () => []) {
      return createLeaveWithoutOverlap({ Leave, Trainer, data, findLegacySchedules });
    },
  };
};

const conflict = error => error.statusCode === 409 && /already exists/.test(error.message);

test('concurrent double submissions create only one leave after transaction retry', async () => {
  const db = database();
  const results = await Promise.allSettled([db.create(), db.create()]);
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(results.filter(row => row.status === 'rejected' && conflict(row.reason)).length, 1);
  assert.ok(db.retries > 0);
  assert.equal(db.rows.length, 1);
  assert.equal(db.writes, 1);
});

test('sequential duplicate and overlapping active requests are rejected without writes', async () => {
  for (const status of ['pending', 'approved']) {
    for (const range of [
      ['2026-11-04', '2026-11-06'], ['2026-11-03', '2026-11-04'],
      ['2026-11-06', '2026-11-09'], ['2026-11-05', '2026-11-05'],
      ['2026-11-01', '2026-11-10'],
    ]) {
      const db = database([{ ...request(), status }]);
      await assert.rejects(db.create(request({
        startDate: date(range[0]), endDate: date(range[1]), requestType: 'break', reason: 'Different reason',
      })), conflict);
      assert.equal(db.rows.length, 1);
      assert.equal(db.writes, 0);
    }
  }
});

test('cancelled/rejected requests, non-overlapping dates, and another trainer allow a new request', async () => {
  for (const status of ['cancelled', 'rejected']) {
    const db = database([{ ...request(), status }]);
    assert.equal((await db.create()).status, 'pending');
    assert.equal(db.rows.length, 2);
  }
  const db = database([{ ...request(), status: 'approved' }]);
  await Promise.all([
    db.create(request({ startDate: date('2026-11-07'), endDate: date('2026-11-08') })),
    db.create(request({ trainer: 'another-trainer' })),
  ]);
  assert.equal(db.rows.length, 3);
});

test('calendar-day overlap catches historical IST-midnight rows and UTC-midnight rows', async () => {
  for (const stored of ['2026-11-03T18:30:00.000Z', '2026-11-04T00:00:00.000Z']) {
    const db = database([{ ...request({ startDate: new Date(stored), endDate: new Date(stored) }), status: 'approved' }]);
    await assert.rejects(db.create(request({ startDate: date('2026-11-04'), endDate: date('2026-11-04') })), conflict);
    assert.equal(db.writes, 0);
    await db.create(request({ startDate: date('2026-11-05'), endDate: date('2026-11-05') }));
    assert.equal(db.writes, 1);
  }
});

test('slot-only replacements do not block a full-day request, including legacy scope', async () => {
  for (const existing of [
    request({ scope: 'slot' }),
    request({ scope: undefined, reason: 'Ad-hoc slot replacement' }),
    request({ scope: undefined, affectedSchedules: ['slot-1'] }),
  ]) {
    const db = database([{ ...existing, status: 'approved' }]);
    await db.create(request(), async () => [
      { _id: 'slot-1', day: 'Wednesday' }, { _id: 'slot-2', day: 'Wednesday' },
    ]);
    assert.equal(db.rows.length, 2);
  }
});

test('historical full-day requests are resolved against their timetable and still block duplicates', async () => {
  const db = database([{ ...request({ scope: undefined, affectedSchedules: ['slot-1'] }), status: 'approved' }]);
  await assert.rejects(db.create(request(), async () => [{ _id: 'slot-1', day: 'Wednesday' }]), conflict);
  assert.equal(db.writes, 0);
});

test('missing trainer cannot create a leave and transaction errors are not hidden', async () => {
  const db = database();
  await assert.rejects(db.create(request({ trainer: 'missing' })), error => error.statusCode === 404);
  assert.equal(db.writes, 0);
  const failure = new Error('Database unavailable');
  await assert.rejects(createLeaveWithoutOverlap({
    Leave: { db: { transaction: async () => { throw failure; } } }, Trainer: {}, data: request(),
  }), error => error === failure);
});
