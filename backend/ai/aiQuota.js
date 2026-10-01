import { randomUUID } from 'node:crypto';
import AiUsageBucket from '../models/AiUsageBucket.js';

export const DAILY_QUESTIONS = 5;
export const QUESTIONS_PER_MINUTE = 2;
const ZONE = 'America/Los_Angeles';
const positive = (value) => /^\d+$/.test(String(value || '')) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0;

export const quotaPolicy = (env = process.env) => {
  const rpm = positive(env.AI_GEMINI_FREE_RPM);
  const tpm = positive(env.AI_GEMINI_FREE_TPM);
  const rpd = positive(env.AI_GEMINI_FREE_RPD);
  return {
    configured: env.AI_GEMINI_FREE_TIER_CONFIRMED === 'true' && rpm >= 2 && tpm >= 2 && rpd >= 2,
    providerCallsPerMinute: Math.min(12, Math.floor(rpm * .8)),
    inputTokensPerMinute: Math.min(200_000, Math.floor(tpm * .8)),
    providerCallsPerDay: Math.min(400, Math.floor(rpd * .8)),
    questionsPerDay: DAILY_QUESTIONS, questionsPerMinute: QUESTIONS_PER_MINUTE, resetTimezone: ZONE,
  };
};
export const quotaDay = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (key) => parts.find((part) => part.type === key).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
export const nextQuotaReset = (now = new Date()) => {
  const day = quotaDay(now);
  let lo = now.getTime(); let hi = lo + 27 * 3600_000;
  while (hi - lo > 1) {
    const mid = Math.floor((hi + lo) / 2);
    if (quotaDay(new Date(mid)) === day) lo = mid; else hi = mid;
  }
  return new Date(hi);
};
export class AiQuotaError extends Error {
  constructor(code, message, resetAt = new Date(Date.now() + 60_000)) {
    super(message); this.code = code; this.resetAt = resetAt;
    this.status = code === 'AI_SETUP_REQUIRED' ? 503 : 429;
  }
}
const setupError = () => new AiQuotaError('AI_SETUP_REQUIRED', 'Sallu is paused until the administrator confirms the Gemini free tier and configures its quotas.');
const limited = (code, resetAt) => new AiQuotaError(code,
  code === 'AI_DAILY_LIMIT' ? 'You have used your 5 Sallu questions for today. Please try again after the daily reset.'
    : code === 'AI_SHARED_DAILY_LIMIT' ? 'Sallu has reached the shared free API budget for today. Please try again after the daily reset.'
      : 'Sallu is at its request limit. Please wait a minute before trying again.', resetAt);

export const createAiQuota = ({ model = AiUsageBucket, env = process.env, clock = () => new Date() } = {}) => {
  const ensure = async (key, now) => {
    try { await model.updateOne({ _id: key }, { $setOnInsert: { count: 0, events: [], leaseUntil: new Date(0), expiresAt: new Date(now.getTime() + 3 * 86400_000) } }, { upsert: true }); }
    catch (error) { if (error.code !== 11000) throw error; }
  };
  const daily = async (key, limit, now, code) => {
    await ensure(key, now);
    if (!await model.findOneAndUpdate({ _id: key, count: { $lt: limit } }, { $inc: { count: 1 } }, { new: true })) throw limited(code, nextQuotaReset(now));
  };
  const rolling = async (key, calls, tokens, weight, now) => {
    await ensure(key, now);
    const recent = { $filter: { input: '$events', as: 'event', cond: { $gt: ['$$event.at', now.getTime() - 60_000] } } };
    const filter = { _id: key, $expr: { $and: [
      { $lt: [{ $size: recent }, calls] },
      { $lte: [{ $add: [{ $sum: { $map: { input: recent, as: 'event', in: '$$event.tokens' } } }, weight] }, tokens] },
    ] } };
    // One conditional atomic update protects both RPM and TPM across instances.
    const result = await model.findOneAndUpdate(filter, [{ $set: {
      events: { $concatArrays: [recent, [{ at: now.getTime(), tokens: weight }]] },
      expiresAt: new Date(now.getTime() + 3 * 86400_000),
    } }], { new: true });
    if (!result) throw limited('AI_MINUTE_LIMIT', new Date(now.getTime() + 60_000));
  };
  const lease = async (key, leaseId, now) => {
    await ensure(key, now);
    return model.findOneAndUpdate({ _id: key, leaseUntil: { $lte: now } }, { $set: { leaseId, leaseUntil: new Date(now.getTime() + 90_000), expiresAt: new Date(now.getTime() + 3 * 86400_000) } }, { new: true });
  };
  const release = async (keys, leaseId) => {
    await Promise.all(keys.map((key) => model.updateOne({ _id: key, leaseId }, { $set: { leaseUntil: new Date(0) }, $unset: { leaseId: '' } })));
  };
  return {
    async admit(userId) {
      const policy = quotaPolicy(env);
      if (!policy.configured) throw setupError();
      const now = clock(); const leaseId = randomUUID(); const keys = [];
      const shared = await model.findById(`day:${quotaDay(now)}:provider`).lean();
      if ((shared?.count || 0) >= policy.providerCallsPerDay) throw limited('AI_SHARED_DAILY_LIMIT', nextQuotaReset(now));
      try {
        const userKey = `lease:user:${userId}`;
        if (!await lease(userKey, leaseId, now)) throw limited('AI_CONCURRENT_LIMIT', new Date(now.getTime() + 60_000));
        keys.push(userKey);
        for (let slot = 0; slot < 4; slot++) {
          const key = `lease:shared:${slot}`;
          if (await lease(key, leaseId, now)) { keys.push(key); break; }
        }
        if (keys.length !== 2) throw limited('AI_CONCURRENT_LIMIT', new Date(now.getTime() + 60_000));
        await rolling(`minute:user:${userId}`, QUESTIONS_PER_MINUTE, Number.MAX_SAFE_INTEGER, 0, now);
        await daily(`day:${quotaDay(now)}:user:${userId}`, DAILY_QUESTIONS, now, 'AI_DAILY_LIMIT');
        return async () => release(keys, leaseId);
      } catch (error) { await release(keys, leaseId); throw error; }
    },
    async reserveProviderCall(inputUpperBound) {
      const policy = quotaPolicy(env);
      if (!policy.configured) throw setupError();
      const now = clock();
      if (!Number.isSafeInteger(inputUpperBound) || inputUpperBound < 0) throw new Error('Invalid token reservation');
      if (inputUpperBound > policy.inputTokensPerMinute) throw new AiQuotaError('AI_CONTEXT_LIMIT', 'This question needs too much data for Sallu’s free token budget. Please narrow the date range or ask about one trainer or class.');
      await rolling('minute:provider', policy.providerCallsPerMinute, policy.inputTokensPerMinute, inputUpperBound, now);
      await daily(`day:${quotaDay(now)}:provider`, policy.providerCallsPerDay, now, 'AI_SHARED_DAILY_LIMIT');
    },
    async usage(userId, isAdmin = false) {
      const now = clock(); const policy = quotaPolicy(env); const day = quotaDay(now);
      const personal = await model.findById(`day:${day}:user:${userId}`).lean();
      const used = personal?.count || 0;
      const shared = await model.findById(`day:${day}:provider`).lean();
      return { ...policy, used, remaining: Math.max(0, DAILY_QUESTIONS - used), resetAt: nextQuotaReset(now).toISOString(),
        sharedExhausted: policy.configured && (shared?.count || 0) >= policy.providerCallsPerDay,
        ...(isAdmin ? { sharedUsed: shared?.count || 0, sharedRemaining: Math.max(0, policy.providerCallsPerDay - (shared?.count || 0)) } : {}) };
    },
  };
};
export const aiQuota = createAiQuota();
