import test from 'node:test';
import assert from 'node:assert/strict';
import { createReconnectTimer } from '../reconnectTimer.js';

test('recovery cancels an offline retry even if its callback was already queued', () => {
  let queued;
  let reconnects = 0;
  const timer = createReconnectTimer({ setTimer(fn) { queued = fn; return 1; }, clearTimer() {} });
  timer.schedule(() => { reconnects += 1; }, 300000);
  timer.cancel(); // Bridge becomes ready before the old watchdog timer expires.
  queued();
  assert.equal(reconnects, 0);
  assert.equal(timer.pending, false);
  timer.schedule(() => { reconnects += 1; }, 15000);
  queued();
  assert.equal(reconnects, 1);
  assert.equal(timer.pending, false);
});

test('repeated watchdog checks do not postpone an existing reconnect', () => {
  let scheduled = 0;
  const timer = createReconnectTimer({ setTimer() { scheduled += 1; return scheduled; }, clearTimer() {} });
  timer.schedule(() => {}, 15000);
  timer.schedule(() => {}, 30000);
  assert.equal(scheduled, 1);
});
