import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiQuota, quotaPolicy, quotaDay, nextQuotaReset } from '../../ai/aiQuota.js';

const env = { AI_GEMINI_FREE_TIER_CONFIRMED: 'true', AI_GEMINI_FREE_RPM: '5', AI_GEMINI_FREE_TPM: '100000', AI_GEMINI_FREE_RPD: '500' };
// Evaluate the small Mongo expression subset used by the atomic rolling-window update.
const evaluate = (expr, doc, vars = {}) => {
  if (typeof expr === 'string' && expr.startsWith('$$')) { const [key, field] = expr.slice(2).split('.'); return field ? vars[key][field] : vars[key]; }
  if (typeof expr === 'string' && expr.startsWith('$')) return doc[expr.slice(1)];
  if (Array.isArray(expr)) return expr.map((item) => evaluate(item, doc, vars));
  if (!expr || typeof expr !== 'object' || expr instanceof Date) return expr;
  const [op, value] = Object.entries(expr)[0];
  if (op === '$filter') return evaluate(value.input, doc, vars).filter((item) => evaluate(value.cond, doc, { ...vars, [value.as]: item }));
  if (op === '$map') return evaluate(value.input, doc, vars).map((item) => evaluate(value.in, doc, { ...vars, [value.as]: item }));
  const values = evaluate(value, doc, vars);
  if (op === '$and') return values.every(Boolean);
  if (op === '$gt') return values[0] > values[1];
  if (op === '$lt') return values[0] < values[1];
  if (op === '$lte') return values[0] <= values[1];
  if (op === '$size') return values.length;
  if (op === '$add' || op === '$sum') return values.reduce((sum, item) => sum + item, 0);
  if (op === '$concatArrays') return values.flat();
  return expr;
};
const memoryModel = () => {
  const records = new Map();
  const matches = (doc, filter) => doc && (!filter.leaseId || doc.leaseId === filter.leaseId)
    && (!filter.leaseUntil || doc.leaseUntil <= filter.leaseUntil.$lte)
    && (!filter.count || doc.count < filter.count.$lt)
    && (!filter.$expr || evaluate(filter.$expr, doc));
  const update = (doc, changes) => {
    if (Array.isArray(changes)) { const values = Object.fromEntries(Object.entries(changes[0].$set).map(([key, value]) => [key, evaluate(value, doc)])); Object.assign(doc, values); }
    else {
      Object.assign(doc, changes.$set || {});
      for (const [key, value] of Object.entries(changes.$inc || {})) doc[key] += value;
      for (const key of Object.keys(changes.$unset || {})) delete doc[key];
    }
  };
  return {
    records,
    async updateOne(filter, changes, options = {}) {
      if (!records.has(filter._id) && options.upsert) records.set(filter._id, { _id: filter._id, ...structuredClone(changes.$setOnInsert) });
      const doc = records.get(filter._id); if (matches(doc, filter)) update(doc, changes);
    },
    async findOneAndUpdate(filter, changes) {
      const doc = records.get(filter._id); if (!matches(doc, filter)) return null;
      update(doc, changes); return structuredClone(doc);
    },
    findById(key) { return { lean: async () => structuredClone(records.get(key) || null) }; },
  };
};
const fixture = (overrides = {}) => {
  const model = memoryModel(); let time = new Date('2026-10-01T09:00:00Z');
  const options = { model, env: { ...env, ...overrides }, clock: () => time };
  return { model, quota: createAiQuota(options), restart: () => createAiQuota(options), advance: (ms) => { time = new Date(time.getTime() + ms); } };
};

test('free quota policy pauses on missing/unconfirmed settings, uses 80% headroom and hard caps', async () => {
  assert.equal(quotaPolicy({}).configured, false);
  assert.equal(quotaPolicy({ ...env, AI_GEMINI_FREE_TIER_CONFIRMED: 'false' }).configured, false);
  assert.equal(quotaPolicy({ ...env, AI_GEMINI_FREE_RPM: '10bad' }).configured, false);
  assert.equal(quotaPolicy(env).providerCallsPerDay, 400);
  assert.equal(quotaPolicy(env).providerCallsPerMinute, 4);
  assert.equal(quotaPolicy(env).inputTokensPerMinute, 80000);
  const actual = quotaPolicy({ ...env, AI_GEMINI_FREE_RPM: '15', AI_GEMINI_FREE_TPM: '250000' });
  assert.equal(actual.providerCallsPerMinute, 12); assert.equal(actual.inputTokensPerMinute, 200000);
  const { quota, model } = fixture({ AI_GEMINI_FREE_TIER_CONFIRMED: 'false' });
  await assert.rejects(quota.admit('u'), (e) => e.code === 'AI_SETUP_REQUIRED');
  assert.equal(model.records.size, 0);
});
test('daily reset follows Pacific time including the 25-hour daylight-saving transition', () => {
  assert.equal(quotaDay(new Date('2026-10-01T06:59:59Z')), '2026-09-30');
  assert.equal(nextQuotaReset(new Date('2026-10-01T06:59:59Z')).toISOString(), '2026-10-01T07:00:00.000Z');
  assert.equal(nextQuotaReset(new Date('2026-11-01T07:00:00Z')).toISOString(), '2026-11-02T08:00:00.000Z');
});
test('two questions per rolling minute and five per day survive quota service restarts', async () => {
  const { quota, restart, advance } = fixture();
  for (let i = 0; i < 2; i++) await (await quota.admit('u'))();
  await assert.rejects(quota.admit('u'), (e) => e.code === 'AI_MINUTE_LIMIT');
  advance(60001);
  for (let i = 0; i < 3; i++) { await (await restart().admit('u'))(); advance(60001); }
  await assert.rejects(restart().admit('u'), (e) => e.code === 'AI_DAILY_LIMIT');
  const usage = await restart().usage('u');
  assert.equal(usage.remaining, 0); assert.equal(usage.used, 5); assert.equal(usage.sharedUsed, undefined);
  advance(86400000); await (await quota.admit('u'))(); assert.equal((await quota.usage('u')).used, 1);
});
test('concurrent submissions across instances admit one per account and four globally', async () => {
  const { quota, restart, advance } = fixture();
  const sameUser = await Promise.allSettled(Array.from({ length: 8 }, () => restart().admit('same')));
  assert.equal(sameUser.filter((r) => r.status === 'fulfilled').length, 1);
  const firstRelease = sameUser.find((r) => r.status === 'fulfilled').value;
  advance(90001);
  const secondRelease = await quota.admit('same');
  await firstRelease(); // Stale owner cannot release the new instance's lease.
  await assert.rejects(quota.admit('same'), (e) => e.code === 'AI_CONCURRENT_LIMIT');
  await secondRelease();
  const all = await Promise.allSettled(Array.from({ length: 9 }, (_, i) => restart().admit(`u${i}`)));
  const accepted = all.filter((r) => r.status === 'fulfilled'); assert.equal(accepted.length, 4);
  await Promise.all(accepted.map((r) => r.value()));
});
test('provider reservations enforce rolling RPM, TPM and daily totals, including failed calls', async () => {
  const { quota, restart, advance } = fixture({ AI_GEMINI_FREE_RPD: '5' });
  const calls = await Promise.allSettled(Array.from({ length: 8 }, () => restart().reserveProviderCall(1000)));
  assert.equal(calls.filter((r) => r.status === 'fulfilled').length, 4);
  advance(60001);
  await assert.rejects(quota.reserveProviderCall(1000), (e) => e.code === 'AI_SHARED_DAILY_LIMIT');
  const usage = await quota.usage('u', true); assert.equal(usage.sharedUsed, 4); assert.equal(usage.sharedRemaining, 0);
  await assert.rejects(quota.admit('new-user'), (e) => e.code === 'AI_SHARED_DAILY_LIMIT');
  assert.equal((await quota.usage('new-user')).used, 0);
  assert.equal((await quota.usage('new-user')).sharedExhausted, true);
  const tokenFixture = fixture({ AI_GEMINI_FREE_TPM: '5000' });
  await tokenFixture.quota.reserveProviderCall(3000);
  await assert.rejects(tokenFixture.quota.reserveProviderCall(1500), (e) => e.code === 'AI_MINUTE_LIMIT');
  await assert.rejects(tokenFixture.quota.reserveProviderCall(4001), (e) => e.code === 'AI_CONTEXT_LIMIT');
});


test('admins bypass personal daily and minute limits but retain shared budget and concurrent limits', async () => {
  const { quota, restart } = fixture();
  for (let i = 0; i < 8; i++) await (await restart().admit('admin', true))();
  const usage = await quota.usage('admin', true);
  assert.equal(usage.used, 8);
  assert.equal(usage.unlimitedPersonal, true);
  assert.equal(usage.remaining, null);
  assert.equal(usage.questionsPerDay, null);
  assert.equal(usage.questionsPerMinute, null);
  assert.equal((await quota.usage('regular')).questionsPerDay, 5);
  const release = await quota.admit('admin', true);
  await assert.rejects(restart().admit('admin', true), e => e.code === 'AI_CONCURRENT_LIMIT');
  await release();
  const shared = fixture({ AI_GEMINI_FREE_RPD: '5' });
  for (let i = 0; i < 4; i++) await shared.quota.reserveProviderCall(1000);
  await assert.rejects(shared.quota.admit('admin', true), e => e.code === 'AI_SHARED_DAILY_LIMIT');
  await assert.rejects(shared.quota.reserveProviderCall(1000), e => e.code === 'AI_MINUTE_LIMIT');
  shared.advance(60001);
  await assert.rejects(shared.quota.reserveProviderCall(1000), e => e.code === 'AI_SHARED_DAILY_LIMIT');
});
