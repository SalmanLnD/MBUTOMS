import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSessionToken, protectCookieRequest, setSessionCookie } from '../../utils/sessionCookie.js';

test('session cookie is HttpOnly and not readable from a different cookie', () => {
  const response = { cookie(name, value, options) { this.name = name; this.value = value; this.options = options; } };
  setSessionCookie(response, 'test-token');
  assert.equal(response.name, 'toms_session');
  assert.equal(response.options.httpOnly, true);
  assert.equal(getSessionToken({ headers: { cookie: 'other=x; toms_session=test-token' } }), 'test-token');
});

test('cookie-authenticated writes require a trusted origin and custom header', () => {
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } });
  const base = { method: 'POST', path: '/api/test', headers: { cookie: 'toms_session=test-token' } };
  let called = false;
  const bad = response(); protectCookieRequest(base, bad, () => { called = true; });
  assert.equal(bad.statusCode, 403); assert.equal(called, false);
  const good = response(); protectCookieRequest({ ...base, headers: { ...base.headers, origin: 'https://mbutoms.onrender.com', 'x-toms-request': '1' } }, good, () => { called = true; });
  assert.equal(called, true);
});
