import { chatWithAi, AI_UNAVAILABLE_MESSAGE } from './aiService.js';
import { aiQuota, AiQuotaError } from './aiQuota.js';
import { ROLES } from '../utils/roles.js';

export const AI_ACCESS_ROLES = Object.values(ROLES);
const permitted = (req) => req.user && !req.impersonator && AI_ACCESS_ROLES.includes(req.user.role)
  && !req.user.mustResetPassword && !req.user.requiresPasswordReset;
const access = (req, res) => {
  if (!req.user) { res.status(401).json({ message: 'Not authorized' }); return false; }
  if (!permitted(req)) { res.status(403).json({ message: 'Sign in to your own account and complete any required password reset to use Sallu.' }); return false; }
  return true;
};
const failure = (error, res) => {
  if (error instanceof AiQuotaError) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))));
    return res.status(error.status).json({ message: error.message, code: error.code, resetAt: error.resetAt.toISOString() });
  }
  return res.status(503).json({ message: AI_UNAVAILABLE_MESSAGE });
};
export const createAiController = (service = chatWithAi, quota = aiQuota) => async (req, res) => {
  if (!access(req, res)) return;
  if (!req.body || Object.keys(req.body).some((key) => key !== 'message') || typeof req.body.message !== 'string'
    || !req.body.message.trim() || req.body.message.length > 2000) {
    return res.status(400).json({ message: 'Send only a non-empty message of at most 2000 characters.' });
  }
  let release;
  try {
    release = await quota.admit(String(req.user._id), req.user.role === ROLES.ADMIN);
    const result = await service({ message: req.body.message.trim(), req });
    res.json(result);
  } catch (error) { failure(error, res); }
  finally { if (release) await release().catch(() => {}); }
};
export const createAiUsageController = (quota = aiQuota) => async (req, res) => {
  if (!access(req, res)) return;
  try { res.json(await quota.usage(String(req.user._id), req.user.role === ROLES.ADMIN)); }
  catch (error) { failure(error, res); }
};
export const aiChat = createAiController();
export const aiUsage = createAiUsageController();
