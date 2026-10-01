import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import { APP_VERSION } from '../../utils/sessionVersion.js';
import { createAiRouter } from '../../routes/aiRoutes.js';
import { createAiController } from '../../ai/aiController.js';
import { attachManagerEditNotifier } from '../../utils/managerEditNotifications.js';

test('AI endpoint uses real protect middleware for missing, invalid and valid sessions', async (t) => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'local-test-secret-not-a-production-key';
  t.after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  let role = 'subject_coordinator';
  t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: 'route-test-user', role, trainer: 'own', isActive: true, sessionVersion: 1 }) }));
  let calls = 0;
  const app = express();
  app.use(express.json());
  app.use('/api/ai', createAiRouter({ controller: createAiController(async ({ req, message }) => {
    assert.equal(req.user.trainer, 'own'); assert.equal(message, 'My timetable'); calls++;
    return { message: 'You have two scheduled classes.', toolCalls: [] };
  }) }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/ai/chat`;
  const post = (token, body = { message: 'My timetable' }) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  assert.equal((await post()).status, 401);
  assert.equal((await post('invalid-jwt')).status, 401);
  const token = jwt.sign({ id: 'route-test-user', sv: 1, av: APP_VERSION }, process.env.JWT_SECRET);
  const result = await post(token);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { message: 'You have two scheduled classes.', toolCalls: [] });
  assert.equal(calls, 1);
  assert.equal((await post(token, { message: 'My timetable', role: 'admin', trainerId: 'other' })).status, 400);
  assert.equal((await post(token, { message: ' ' })).status, 400);
  assert.equal((await post(token, { message: 'x'.repeat(2001) })).status, 400);
  for (const deniedRole of ['trainer', 'manager', 'campus_manager', 'evaluator']) {
    role = deniedRole;
    assert.equal((await post(token)).status, 403);
  }
  role = 'admin';
  assert.equal((await post(token)).status, 200);
  const impersonatedToken = jwt.sign({ id: 'route-test-user', sv: 1, av: APP_VERSION, impersonatedBy: 'admin-id' }, process.env.JWT_SECRET);
  assert.equal((await post(impersonatedToken)).status, 403);
});

test('controller hides provider errors and rejects simultaneous requests', async () => {
  const req = { user: { _id: 'concurrent-test-user', role: 'admin' }, body: { message: 'Hello' } };
  const response = () => ({ code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {} });
  let finish;
  const controller = createAiController(() => new Promise((resolve) => { finish = resolve; }));
  const first = response();
  const pending = controller(req, first);
  const second = response(); await controller(req, second);
  assert.equal(second.code, 429);
  finish({ message: 'Ready', toolCalls: [] }); await pending;
  const error = response();
  await createAiController(async () => { throw new Error('provider-key-and-stack'); })(req, error);
  assert.equal(error.code, 503);
  assert.ok(!JSON.stringify(error.body).includes('provider-key'));
});

test('read-only assistant POST does not attach management edit notifications', () => {
  const req = { method: 'POST', originalUrl: '/api/ai/chat', user: { role: 'campus_manager', _id: 'manager' } };
  const json = () => {};
  const res = { locals: {}, json };
  attachManagerEditNotifier(req, res);
  assert.equal(res.json, json);
  assert.equal(res.locals.managerEditNotifierAttached, undefined);
  const mutatingReq = { ...req, originalUrl: '/api/classes' };
  attachManagerEditNotifier(mutatingReq, res);
  assert.notEqual(res.json, json);
  assert.equal(res.locals.managerEditNotifierAttached, true);
});
