// Explicit integration audit in an isolated temporary collection, with no Gemini calls.
import 'dotenv/config';
import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import AiUsageBucket from '../models/AiUsageBucket.js';
import { createAiQuota } from '../ai/aiQuota.js';

const collection = `ai_quota_audit_${randomUUID().replaceAll('-', '')}`;
const connection = await mongoose.createConnection(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 }).asPromise();
try {
  const model = connection.model('AiQuotaAudit', AiUsageBucket.schema.clone(), collection);
  const env = { AI_GEMINI_FREE_TIER_CONFIRMED: 'true', AI_GEMINI_FREE_RPM: '5', AI_GEMINI_FREE_TPM: '100000', AI_GEMINI_FREE_RPD: '5' };
  let now = new Date('2026-10-01T09:00:00Z');
  const create = () => createAiQuota({ model, env, clock: () => now });
  const requests = await Promise.allSettled(Array.from({ length: 10 }, () => create().admit('audit-user')));
  const accepted = requests.filter((r) => r.status === 'fulfilled');
  assert.equal(accepted.length, 1); await accepted[0].value();
  await (await create().admit('audit-user'))();
  await assert.rejects(create().admit('audit-user'), (e) => e.code === 'AI_MINUTE_LIMIT');
  now = new Date(now.getTime() + 60001);
  for (let i = 0; i < 3; i++) { await (await create().admit('audit-user'))(); now = new Date(now.getTime() + 60001); }
  await assert.rejects(create().admit('audit-user'), (e) => e.code === 'AI_DAILY_LIMIT');
  const provider = await Promise.allSettled(Array.from({ length: 10 }, () => create().reserveProviderCall(1000)));
  assert.equal(provider.filter((r) => r.status === 'fulfilled').length, 4);
  now = new Date(now.getTime() + 60001);
  await assert.rejects(create().reserveProviderCall(1000), (e) => e.code === 'AI_SHARED_DAILY_LIMIT');
  const usage = await create().usage('audit-user', true);
  assert.equal(usage.used, 5); assert.equal(usage.sharedUsed, 4);
  console.log('MongoDB atomic quota audit passed: concurrent admission, rolling minute, daily persistence, provider calls.');
} finally {
  // Only this uniquely named audit collection is removed.
  assert.match(collection, /^ai_quota_audit_[a-f0-9]{32}$/);
  await connection.dropCollection(collection).catch((error) => { if (error.code !== 26) throw error; });
  await connection.close();
}
