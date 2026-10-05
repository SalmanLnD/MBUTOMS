import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIosDevice, isStandalone, pushSupportReason, decodeApplicationKey } from './pwaSupport.js';
const nav = { userAgent: 'Chrome', platform: 'Win32', serviceWorker: {} };
const browser = { isSecureContext: true, PushManager: {}, Notification: {}, matchMedia: () => ({ matches: false }) };
test('detects iPhone and desktop-identified iPads and installed display mode', () => {
  assert.equal(isIosDevice({ ...nav, userAgent: 'iPhone' }), true);
  assert.equal(isIosDevice({ ...nav, platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(isIosDevice({ ...nav, platform: 'MacIntel', maxTouchPoints: 0 }), false);
  assert.equal(isStandalone(browser, { ...nav, standalone: true }), true);
});
test('permission controls explain secure context, iOS installation and unsupported browser requirements', () => {
  assert.equal(pushSupportReason(browser, nav), '');
  assert.match(pushSupportReason({ ...browser, isSecureContext: false }, nav), /HTTPS/);
  assert.match(pushSupportReason(browser, { ...nav, userAgent: 'iPhone' }), /Home Screen/);
  assert.equal(pushSupportReason(browser, { ...nav, userAgent: 'iPhone', standalone: true }), '');
  assert.match(pushSupportReason({ ...browser, PushManager: undefined, Notification: undefined }, { userAgent: 'Firefox', platform: 'Linux' }), /does not support/);
  assert.deepEqual([...decodeApplicationKey('AQID_w')], [1, 2, 3, 255]);
});
