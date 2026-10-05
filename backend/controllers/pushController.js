import PushSubscription from '../models/PushSubscription.js';
import { getWebPushConfig, normalizePushSubscription } from '../utils/webPush.js';

export const getPushConfig = (_req, res) => {
  const config = getWebPushConfig();
  res.json({ configured: Boolean(config), publicKey: config?.publicKey || '' });
};

export const savePushSubscription = async (req, res) => {
  if (req.impersonator) return res.status(403).json({ message: 'Exit trainer view before enabling device notifications.' });
  const config = getWebPushConfig();
  if (!config) return res.status(503).json({ message: 'Device notifications are not configured yet.' });
  const subscription = normalizePushSubscription(req.body.subscription);
  if (!subscription || req.body.publicKey !== config.publicKey) {
    return res.status(400).json({ message: 'Invalid push subscription. Please try enabling notifications again.' });
  }
  await PushSubscription.findOneAndUpdate({ endpoint: subscription.endpoint }, { $set: {
    ...subscription, recipient: req.user._id, sessionVersion: req.user.sessionVersion ?? 1,
    vapidPublicKey: config.publicKey,
  } }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
  res.status(201).json({ enabled: true });
};

export const removePushSubscription = async (req, res) => {
  if (req.impersonator) return res.status(403).json({ message: 'Exit trainer view before changing device notifications.' });
  const endpoint = req.body.endpoint;
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return res.status(400).json({ message: 'Invalid endpoint.' });
  await PushSubscription.deleteOne({ endpoint, recipient: req.user._id });
  res.json({ enabled: false });
};
