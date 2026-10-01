import { chatWithAi, AI_UNAVAILABLE_MESSAGE } from './aiService.js';

const requestWindows = new Map();
const inFlight = new Set();
export const AI_ACCESS_ROLES = ['admin', 'subject_coordinator'];

export const createAiController = (service = chatWithAi) => async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Not authorized' });
  if (req.impersonator || !AI_ACCESS_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: 'TOMS Assistant is available only to admins and subject coordinators outside trainer view.' });
  }
  if (!req.body || Object.keys(req.body).some((key) => key !== 'message')
    || typeof req.body.message !== 'string' || !req.body.message.trim() || req.body.message.length > 2000) {
    return res.status(400).json({ message: 'Send only a non-empty message of at most 2000 characters.' });
  }
  const userId = String(req.user._id);
  const now = Date.now();
  for (const [key, window] of requestWindows) {
    if (now - window.start >= 60_000) requestWindows.delete(key);
  }
  const window = requestWindows.get(userId) || { start: now, count: 0 };
  if (window.count >= 10 || inFlight.has(userId) || inFlight.size >= 4) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ message: 'The TOMS Assistant is busy. Please try again shortly.' });
  }
  window.count += 1;
  requestWindows.set(userId, window);
  inFlight.add(userId);
  try {
    const result = await service({ message: req.body.message.trim(), req });
    res.json(result);
  } catch {
    res.status(503).json({ message: AI_UNAVAILABLE_MESSAGE });
  } finally {
    inFlight.delete(userId);
  }
};

export const aiChat = createAiController();
