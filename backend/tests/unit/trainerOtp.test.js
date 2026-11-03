import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrainerOtp, isUsableTrainerOtp } from '../../utils/trainerOtp.js';
import { login } from '../../controllers/authController.js';
import User from '../../models/User.js';

test('trainer OTP is six digits and expires after 24 hours', () => {
  const now = new Date('2026-11-03T00:00:00Z');
  const { otp, expiresAt } = createTrainerOtp(now);
  assert.match(otp, /^\d{6}$/);
  assert.equal(expiresAt.getTime() - now.getTime(), 24 * 60 * 60 * 1000);
  assert.equal(isUsableTrainerOtp({ mustResetPassword: true, otpExpiresAt: expiresAt, otpAttempts: 0 }, now), true);
  assert.equal(isUsableTrainerOtp({ mustResetPassword: true, otpExpiresAt: expiresAt, otpAttempts: 5 }, now), false);
  assert.equal(isUsableTrainerOtp({ mustResetPassword: true, otpExpiresAt: expiresAt, otpAttempts: 0 }, expiresAt), false);
  assert.equal(isUsableTrainerOtp({ mustResetPassword: true }, now), false);
});

test('OTP login is consumed once and produces only an HttpOnly session cookie', async t => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-only-session-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  const user = { _id: 'user', role: 'trainer', isActive: true, sessionVersion: 1, mustResetPassword: true,
    otpExpiresAt: new Date(Date.now() + 60000), otpAttempts: 0, matchPassword: async value => value === '123456' };
  const chain = { populate() { return this; }, then(resolve, reject) { return Promise.resolve(user).then(resolve, reject); } };
  t.mock.method(User, 'findOne', () => chain);
  t.mock.method(User, 'updateOne', async (filter, update) => {
    if (update.$inc) { user.otpAttempts++; return { modifiedCount: user.otpExpiresAt ? 1 : 0 }; }
    if (!user.otpExpiresAt) return { modifiedCount: 0 };
    user.otpExpiresAt = null; return { modifiedCount: 1 };
  });
  const response = () => ({ code: 200, status(code) { this.code = code; return this; },
    set() { return this; }, cookie(name, value, options) { this.cookieName = name; this.cookieOptions = options; },
    json(value) { this.body = value; return this; } });
  const req = { body: { email: 'trainer@example.test', password: '123456' } };
  const first = response(); await login(req, first);
  assert.equal(first.code, 200); assert.equal(first.cookieName, 'toms_session');
  assert.equal(first.cookieOptions.httpOnly, true); assert.equal(first.body.token, undefined);
  const second = response(); await login(req, second); assert.equal(second.code, 401);
});
