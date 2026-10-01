import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import { APP_VERSION } from '../../utils/sessionVersion.js';
import { createAiRouter } from '../../routes/aiRoutes.js';
import { createAiController, createAiUsageController } from '../../ai/aiController.js';
import { attachManagerEditNotifier } from '../../utils/managerEditNotifications.js';
import { AiQuotaError } from '../../ai/aiQuota.js';

const quotaStub = { admit: async () => async () => {} };

test('AI endpoint uses real protect middleware for missing, invalid and valid sessions', async (t) => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'local-test-secret-not-a-production-key';
  t.after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  let role = 'subject_coordinator'; let mustResetPassword = false;
  t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: 'route-test-user', role, trainer: 'own', isActive: true, sessionVersion: 1, mustResetPassword }) }));
  let calls = 0;
  const app = express();
  app.use(express.json());
  app.use('/api/ai', createAiRouter({ controller: createAiController(async ({ req, message }) => {
    assert.equal(req.user.trainer, 'own'); assert.equal(message, 'My timetable'); calls++;
    return { message: 'You have two scheduled classes.', toolCalls: [] };
  }, quotaStub), usageController: createAiUsageController({ usage: async (id, isAdmin) => ({ userId: id, adminSummary: isAdmin }) }) }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/ai/chat`;
  const post = (token, body = { message: 'My timetable' }) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  assert.equal((await post()).status, 401);
  assert.equal((await post('invalid-jwt')).status, 401);
  const token = jwt.sign({ id: 'route-test-user', sv: 1, av: APP_VERSION }, process.env.JWT_SECRET);
  const previousReleaseToken = jwt.sign({ id: 'route-test-user', sv: 1, av: '2.2.0' }, process.env.JWT_SECRET);
  const oldSession = await post(previousReleaseToken);
  assert.equal(oldSession.status, 401); assert.equal((await oldSession.json()).code, 'APP_VERSION_UPDATED');
  const result = await post(token);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { message: 'You have two scheduled classes.', toolCalls: [] });
  assert.equal(calls, 1);
  assert.equal((await post(token, { message: 'My timetable', role: 'admin', trainerId: 'other' })).status, 400);
  assert.equal((await post(token, { message: ' ' })).status, 400);
  assert.equal((await post(token, { message: 'x'.repeat(2001) })).status, 400);
  for (const allowedRole of ['trainer', 'manager', 'campus_manager', 'evaluator']) {
    role = allowedRole;
    assert.equal((await post(token)).status, 200);
    const usage = await fetch(url.replace('/chat', '/usage'), { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(usage.status, 200); assert.deepEqual(await usage.json(), { userId: 'route-test-user', adminSummary: false });
  }
  role = 'admin';
  assert.equal((await post(token)).status, 200);
  mustResetPassword = true; assert.equal((await post(token)).status, 403); mustResetPassword = false;
  const impersonatedToken = jwt.sign({ id: 'route-test-user', sv: 1, av: APP_VERSION, impersonatedBy: 'admin-id' }, process.env.JWT_SECRET);
  assert.equal((await post(impersonatedToken)).status, 403);
});

test('controller hides provider errors and rejects simultaneous requests', async () => {
  const req = { user: { _id: 'concurrent-test-user', role: 'admin' }, body: { message: 'Hello' } };
  const response = () => ({ code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {} });
  let finish;
  let active = false;
  const quota = { admit: async () => {
    if (active) throw new AiQuotaError('AI_CONCURRENT_LIMIT', 'Please wait.');
    active = true; return async () => { active = false; };
  } };
  const controller = createAiController(() => new Promise((resolve) => { finish = resolve; }), quota);
  const first = response();
  const pending = controller(req, first);
  const second = response(); await controller(req, second);
  assert.equal(second.code, 429);
  finish({ message: 'Ready', toolCalls: [] }); await pending;
  const error = response();
  await createAiController(async () => { throw new Error('provider-key-and-stack'); }, quotaStub)(req, error);
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
