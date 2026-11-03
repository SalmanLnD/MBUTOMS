import { test } from 'node:test';
import assert from 'node:assert/strict';
import User from '../../models/User.js';
import jwt from 'jsonwebtoken';
import { resetPassword, logout, login } from '../../controllers/authController.js';
import { protect } from '../../middleware/auth.js';
import { SESSION_APP_VERSION } from '../../utils/sessionVersion.js';

test('password setup requires at least 12 characters without altering existing logins', async () => {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await resetPassword({ user: { _id: 'user' }, body: { newPassword: '123456', confirmPassword: '123456' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /12/);
});

test('existing shorter passwords remain valid when the user is not resetting', async t => {
  const previous = process.env.JWT_SECRET; process.env.JWT_SECRET = 'test-secret';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const user = { _id: 'existing', isActive: true, role: 'trainer', sessionVersion: 1, mustResetPassword: false, matchPassword: async value => value === 'old123' };
  const query = { populate() { return this; }, then(resolve, reject) { return Promise.resolve(user).then(resolve, reject); } };
  t.mock.method(User, 'findOne', () => query);
  const res = { cookie() { this.cookieSet = true; }, set() {}, json(body) { this.body = body; }, status(code) { this.code = code; return this; } };
  await login({ body: { email: 'existing@example.test', password: 'old123' } }, res);
  assert.equal(res.cookieSet, true); assert.equal(res.body.mustResetPassword, false);
});

test('a copied token is rejected after logout increments its session version', async t => {
  const previous = process.env.JWT_SECRET; process.env.JWT_SECRET = 'test-secret';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const user = { _id: 'trainer', role: 'trainer', isActive: true, sessionVersion: 1 };
  t.mock.method(User, 'updateOne', async () => { user.sessionVersion++; return { matchedCount: 1 }; });
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  const token = jwt.sign({ id: 'trainer', sv: 1, av: SESSION_APP_VERSION }, process.env.JWT_SECRET);
  await logout({ user }, { clearCookie() {}, json() {} });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await protect({ headers: { authorization: `Bearer ${token}` } }, res, () => assert.fail('Revoked token accepted'));
  assert.equal(res.code, 401);
});

test('logout revokes existing sessions before clearing the cookie', async t => {
  let filter, update;
  t.mock.method(User, 'updateOne', async (f, u) => { filter = f; update = u; return { matchedCount: 1 }; });
  const res = { clearCookie() { this.cleared = true; }, json(value) { this.body = value; } };
  await logout({ user: { _id: 'trainer' } }, res);
  assert.equal(filter._id, 'trainer'); assert.equal(update.$inc.sessionVersion, 1); assert.equal(res.cleared, true);
});
