import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import { protect } from '../../middleware/auth.js';
import { login } from '../../controllers/authController.js';
import { APP_VERSION, SESSION_APP_VERSION } from '../../utils/sessionVersion.js';

test('patch update retains 2.2.1 sessions and still rejects revoked, expired and incompatible sessions', async t => {
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'patch-session-test-only';
  t.after(() => { secret === undefined ? delete process.env.JWT_SECRET : process.env.JWT_SECRET = secret; });
  let active = true;
  t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: 'test-user', role: 'trainer', isActive: active, sessionVersion: 3 }) }));
  const app = express();
  app.get('/session', protect, (req, res) => res.json({ id: req.user._id, version: APP_VERSION }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const request = (payload, options) => fetch(`http://127.0.0.1:${server.address().port}/session`, {
    headers: { Authorization: `Bearer ${jwt.sign({ id: 'test-user', sv: 3, av: '2.2.1', ...payload }, process.env.JWT_SECRET, options)}` },
  });
  assert.equal(APP_VERSION, '2.2.2');
  assert.equal(SESSION_APP_VERSION, '2.2.1');
  assert.equal((await request({})).status, 200, 'Existing logged-in users must remain signed in');
  assert.equal((await request({ av: APP_VERSION })).status, 200);
  const incompatible = await request({ av: '2.2.0' });
  assert.equal(incompatible.status, 401); assert.equal((await incompatible.json()).code, 'APP_VERSION_UPDATED');
  assert.equal((await request({ sv: 2 })).status, 401);
  assert.equal((await request({}, { expiresIn: -1 })).status, 401);
  active = false; assert.equal((await request({})).status, 401);
});

test('new logins report the patch release while issuing tokens with the stable session version', async t => {
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'patch-login-test-only';
  t.after(() => { secret === undefined ? delete process.env.JWT_SECRET : process.env.JWT_SECRET = secret; });
  const user = { _id: 'test-admin', name: 'Test', email: 'test@example.invalid', role: 'admin', isActive: true, sessionVersion: 3,
    matchPassword: async password => password === 'test-password' };
  const query = { populate() { return this; }, then(resolve, reject) { return Promise.resolve(user).then(resolve, reject); } };
  t.mock.method(User, 'findOne', () => query);
  let response;
  await login({ body: { email: user.email, password: 'test-password' } }, { json: value => { response = value; } });
  assert.equal(response.appVersion, APP_VERSION);
  const token = jwt.verify(response.token, process.env.JWT_SECRET);
  assert.equal(token.av, SESSION_APP_VERSION); assert.equal(token.sv, 3);
});
