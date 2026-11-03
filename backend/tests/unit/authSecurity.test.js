import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import { protect, allowPasswordResetSession } from '../../middleware/auth.js';
import { SESSION_APP_VERSION } from '../../utils/sessionVersion.js';
import { createLoginRateLimiter, createDistributedLoginRateLimiter } from '../../middleware/loginRateLimit.js';

test('password-reset sessions cannot access normal protected routes', async t => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: 'test', role: 'trainer', isActive: true, sessionVersion: 1, mustResetPassword: true }) }));
  const app = express();
  app.get('/normal', protect, (req, res) => res.sendStatus(200));
  app.get('/reset', allowPasswordResetSession, protect, (req, res) => res.sendStatus(200));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const token = jwt.sign({ id: 'test', sv: 1, av: SESSION_APP_VERSION }, process.env.JWT_SECRET);
  const get = path => fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await get('/normal')).status, 403);
  assert.equal((await get('/reset')).status, 200);
});

test('distributed login limit shares counts through its store', async () => {
  let count = 0;
  const store = { findOneAndUpdate: async () => ({ count: ++count }) };
  const a = createDistributedLoginRateLimiter({ store, max: 2, clock: () => 1000 });
  const b = createDistributedLoginRateLimiter({ store, max: 2, clock: () => 1000 });
  const req = { ip: '127.0.0.1' };
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, set() { return this; }, json() { return this; } });
  let passed = 0;
  await a(req, response(), () => passed++); await b(req, response(), () => passed++);
  const blocked = response(); await a(req, blocked, () => passed++);
  assert.equal(passed, 2); assert.equal(blocked.statusCode, 429);
});

test('login rate limit blocks repeated requests and resets after its window', () => {
  let now = 0;
  const limiter = createLoginRateLimiter({ max: 2, windowMs: 1000, clock: () => now });
  const req = { ip: '127.0.0.1' };
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, set() { return this; }, json() { return this; } });
  let passed = 0;
  limiter(req, response(), () => passed++);
  limiter(req, response(), () => passed++);
  const blocked = response(); limiter(req, blocked, () => passed++);
  assert.equal(blocked.statusCode, 429); assert.equal(passed, 2);
  now = 1000; limiter(req, response(), () => passed++); assert.equal(passed, 3);
});
