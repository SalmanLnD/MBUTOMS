import { createECDH } from 'node:crypto';
import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';
import User from '../models/User.js';

export const getWebPushConfig = (env = process.env) => {
  const publicKey = env.WEB_PUSH_PUBLIC_KEY || '';
  const privateKey = env.WEB_PUSH_PRIVATE_KEY || '';
  const subject = env.WEB_PUSH_SUBJECT || '';
  try {
    if (!/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject)) return null;
    const curve = createECDH('prime256v1');
    curve.setPrivateKey(Buffer.from(privateKey, 'base64url'));
    if (curve.getPublicKey().toString('base64url') !== publicKey) return null;
    return { subject, publicKey, privateKey };
  } catch { return null; }
};

// Accept browser push services only; never let subscriptions turn into arbitrary server requests.
export const isPushEndpoint = (endpoint) => {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;
  try {
    const url = new URL(endpoint);
    const host = url.hostname;
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash
      && (['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'android.googleapis.com'].includes(host)
        || host === 'web.push.apple.com' || host.endsWith('.web.push.apple.com')
        || host.endsWith('.notify.windows.com'));
  } catch { return false; }
};

export const normalizePushSubscription = (input) => {
  if (!isPushEndpoint(input?.endpoint)) return null;
  const { p256dh, auth } = input.keys || {};
  if (typeof p256dh !== 'string' || typeof auth !== 'string'
      || !/^[A-Za-z0-9_-]+={0,2}$/.test(p256dh) || !/^[A-Za-z0-9_-]+={0,2}$/.test(auth)) return null;
  const point = Buffer.from(p256dh, 'base64url');
  if (point.length !== 65 || point[0] !== 4 || Buffer.from(auth, 'base64url').length !== 16) return null;
  // Validate the EC point with a temporary key, without logging subscription data.
  try { const curve = createECDH('prime256v1'); curve.generateKeys(); curve.computeSecret(point); }
  catch { return null; }
  return { endpoint: input.endpoint, keys: { p256dh, auth } };
};

export const safeNotificationPath = (path) => typeof path === 'string'
  && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/api/') && !path.includes('\\')
  ? path : '/dashboard';

export const deliverWebPush = async (notifications, dependencies = {}) => {
  const config = dependencies.config ?? getWebPushConfig();
  if (!config || !notifications?.length) return;
  const subscriptions = dependencies.subscriptions || PushSubscription;
  const users = dependencies.users || User;
  const send = dependencies.send || webpush.sendNotification.bind(webpush);
  const recipientIds = [...new Set(notifications.map(item => String(item.recipient)))];
  const [devices, recipients] = await Promise.all([
    subscriptions.find({ recipient: { $in: recipientIds }, vapidPublicKey: config.publicKey }).lean(),
    users.find({ _id: { $in: recipientIds }, isActive: true }).select('_id sessionVersion').lean(),
  ]);
  const active = new Map(recipients.map(user => [String(user._id), user.sessionVersion ?? 1]));
  const jobs = notifications.flatMap(item => devices.filter(device =>
    String(device.recipient) === String(item.recipient)
    && active.get(String(device.recipient)) === device.sessionVersion
    && isPushEndpoint(device.endpoint)).map(device => ({ item, device })));
  // Bound outgoing connections; await delivery so serverless requests do not abandon pushes.
  for (let offset = 0; offset < jobs.length; offset += 8) {
    await Promise.all(jobs.slice(offset, offset + 8).map(async ({ item, device }) => {
      try {
        await send({ endpoint: device.endpoint, keys: device.keys }, JSON.stringify({
          title: 'TOMS', body: String(item.message || 'You have a new notification').slice(0, 400),
          recipient: String(item.recipient), id: String(item._id), url: safeNotificationPath(item.entityPath),
        }), { vapidDetails: config, TTL: 3600, timeout: 5000, urgency: 'normal' });
      } catch (error) {
        if ([404, 410].includes(error.statusCode)) {
          await subscriptions.deleteOne({ _id: device._id, recipient: device.recipient });
        } else {
          console.warn('TOMS push delivery failed', error.statusCode || 'network');
        }
      }
    }));
  }
};

export const notifyWebPushSafely = async (notifications) => {
  try { await deliverWebPush(notifications); }
  catch { console.warn('TOMS push delivery unavailable; notification remains in inbox'); }
};
