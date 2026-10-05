import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createECDH } from 'node:crypto';
import webpush from 'web-push';
import { deliverWebPush, getWebPushConfig, isPushEndpoint, normalizePushSubscription, safeNotificationPath } from '../../utils/webPush.js';
import { savePushSubscription, removePushSubscription, getPushConfig } from '../../controllers/pushController.js';
import PushSubscription from '../../models/PushSubscription.js';
import Notification from '../../models/Notification.js';
import User from '../../models/User.js';

const keys = webpush.generateVAPIDKeys();
const config = { ...keys, subject: 'https://example.com' };
const env = { WEB_PUSH_PUBLIC_KEY: keys.publicKey, WEB_PUSH_PRIVATE_KEY: keys.privateKey, WEB_PUSH_SUBJECT: config.subject };
const curve = createECDH('prime256v1'); curve.generateKeys();
const valid = { endpoint: 'https://fcm.googleapis.com/fcm/send/example', keys: { p256dh: curve.getPublicKey().toString('base64url'), auth: Buffer.alloc(16, 1).toString('base64url') } };

test('configuration requires matching VAPID keys and a public contact', () => {
  assert.deepEqual(getWebPushConfig(env), config);
  assert.equal(getWebPushConfig({}), null);
  assert.equal(getWebPushConfig({ ...env, WEB_PUSH_PRIVATE_KEY: webpush.generateVAPIDKeys().privateKey }), null);
  assert.equal(getWebPushConfig({ ...env, WEB_PUSH_SUBJECT: 'localhost' }), null);
});

test('subscription validation accepts supported push services and rejects arbitrary destinations/keys', () => {
  assert.deepEqual(normalizePushSubscription(valid), valid);
  for (const url of ['https://updates.push.services.mozilla.com/wpush/v2/test', 'https://web.push.apple.com/test', 'https://wns2.notify.windows.com/test']) assert.equal(isPushEndpoint(url), true);
  for (const url of ['http://fcm.googleapis.com/test', 'https://127.0.0.1/test', 'https://fcm.googleapis.com.evil.test/test', 'https://evil.test', 'https://user@fcm.googleapis.com/test', 'https://fcm.googleapis.com:8443/test']) assert.equal(isPushEndpoint(url), false);
  assert.equal(normalizePushSubscription({ ...valid, keys: { ...valid.keys, auth: 'bad' } }), null);
  assert.equal(normalizePushSubscription({ ...valid, keys: { ...valid.keys, p256dh: Buffer.alloc(65, 4).toString('base64url') } }), null);
  for (const path of ['//evil.test', '/api/auth', '/\\evil.test', 'https://evil.test']) assert.equal(safeNotificationPath(path), '/dashboard');
  assert.equal(safeNotificationPath('/topic-tracker?date=2026-10-05'), '/topic-tracker?date=2026-10-05');
});

const query = value => ({ select() { return this; }, lean: async () => value });
test('push is recipient-specific, ignores inactive/stale sessions, prunes expired endpoints and survives failure', async () => {
  const devices = [
    { ...valid, _id: 'device-1', recipient: 'user-1', sessionVersion: 2 },
    { ...valid, _id: 'device-2', endpoint: valid.endpoint + '-expired', recipient: 'user-1', sessionVersion: 2 },
    { ...valid, _id: 'stale', recipient: 'user-1', sessionVersion: 1 },
    { ...valid, _id: 'inactive', recipient: 'inactive', sessionVersion: 2 },
    { ...valid, _id: 'other', recipient: 'user-2', sessionVersion: 3 },
    { ...valid, _id: 'private', endpoint: 'https://localhost', recipient: 'user-1', sessionVersion: 2 },
  ];
  const sent = [], deleted = [];
  await deliverWebPush([
    { _id: 'alert-1', recipient: 'user-1', message: 'Replacement assigned', entityPath: '/topic-tracker?date=2026-10-05' },
    { _id: 'alert-2', recipient: 'user-2', message: 'Ticket closed', entityPath: '//evil.test' },
    { _id: 'alert-3', recipient: 'inactive', message: 'Should not send' },
  ], { config, subscriptions: { find: () => query(devices), deleteOne: async filter => deleted.push(filter) },
    users: { find: () => query([{ _id: 'user-1', sessionVersion: 2 }, { _id: 'user-2', sessionVersion: 3 }]) },
    send: async (subscription, payload, options) => {
      sent.push({ subscription, payload: JSON.parse(payload), options });
      if (subscription.endpoint.endsWith('-expired')) throw Object.assign(new Error('Expired'), { statusCode: 410 });
    },
  });
  assert.equal(sent.length, 3);
  assert.equal(sent.filter(item => item.payload.recipient === 'user-1').length, 2);
  assert.equal(sent.find(item => item.payload.recipient === 'user-2').payload.url, '/dashboard');
  assert.deepEqual(deleted, [{ _id: 'device-2', recipient: 'user-1' }]);
  assert.equal(sent[0].options.vapidDetails.privateKey, config.privateKey);
  assert.equal(sent[0].options.timeout, 5000);
  await deliverWebPush([], { config, subscriptions: { find: () => { throw new Error('Should not query'); } } });
});

const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
test('subscription endpoints bind authenticated identity, enforce ownership and block impersonation', async t => {
  const original = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => { for (const [key, value] of Object.entries(original)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const writes = [], deletes = [];
  t.mock.method(PushSubscription, 'findOneAndUpdate', async (...args) => writes.push(args));
  t.mock.method(PushSubscription, 'deleteOne', async filter => deletes.push(filter));
  const user = { _id: 'owner', sessionVersion: 4 };
  const res = response();
  await savePushSubscription({ user, body: { subscription: { ...valid, recipient: 'spoofed' }, publicKey: config.publicKey } }, res);
  assert.equal(res.code, 201);
  assert.equal(writes[0][1].$set.recipient, 'owner');
  assert.equal(writes[0][1].$set.sessionVersion, 4);
  await removePushSubscription({ user, body: { endpoint: valid.endpoint } }, response());
  assert.deepEqual(deletes, [{ endpoint: valid.endpoint, recipient: 'owner' }]);
  const forbidden = response();
  await savePushSubscription({ user, impersonator: {}, body: {} }, forbidden);
  assert.equal(forbidden.code, 403);
  const invalid = response();
  await savePushSubscription({ user, body: { subscription: valid, publicKey: 'old' } }, invalid);
  assert.equal(invalid.code, 400);
  const publicConfig = response(); getPushConfig({}, publicConfig);
  assert.deepEqual(publicConfig.body, { configured: true, publicKey: config.publicKey });
});

test('existing Notification.create and insertMany writers push once, while read-state saves do not', async t => {
  const original = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => { for (const [key, value] of Object.entries(original)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const sent = [];
  t.mock.method(PushSubscription, 'find', () => query([{ ...valid, _id: 'device', recipient: '000000000000000000000001', sessionVersion: 1 }]));
  t.mock.method(User, 'find', () => query([{ _id: '000000000000000000000001', sessionVersion: 1 }]));
  t.mock.method(webpush, 'sendNotification', async (_sub, payload) => sent.push(JSON.parse(payload)));
  t.mock.method(Notification.collection, 'insertOne', async doc => ({ acknowledged: true, insertedId: doc._id }));
  t.mock.method(Notification.collection, 'updateOne', async () => ({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }));
  t.mock.method(Notification.collection, 'insertMany', async docs => ({ acknowledged: true, insertedCount: docs.length }));
  const base = { recipient: '000000000000000000000001', actor: '000000000000000000000002', actorName: 'Test', actorRole: 'admin', action: 'updated', resource: 'ticket', message: 'Test alert' };
  const doc = await Notification.create(base);
  assert.equal(sent.length, 1);
  doc.readAt = new Date(); await doc.save();
  assert.equal(sent.length, 1);
  await Notification.insertMany([base, base]);
  assert.equal(sent.length, 3);
});
