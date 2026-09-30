import test from 'node:test';
import assert from 'node:assert/strict';
import { getPopoverPosition } from './popoverPosition.js';

function fits(rect, viewport, options) {
  const p = getPopoverPosition(rect, viewport, options);
  const y = p.transform === 'none' ? p.top : p.top - p.maxHeight;
  assert.ok(p.left >= (viewport.offsetLeft || 0) + 8);
  assert.ok(p.left + p.width <= (viewport.offsetLeft || 0) + viewport.width - 8);
  assert.ok(y >= (viewport.offsetTop || 0) + 8);
  assert.ok(y + p.maxHeight <= (viewport.offsetTop || 0) + viewport.height - 8);
  return p;
}
test('narrow phone clamps a wide trigger to the screen', () => {
  fits({ top: 100, bottom: 144, left: 20, right: 620, width: 600 }, { width: 320, height: 568 });
});
test('short landscape menu opens above its trigger', () => {
  const p = fits({ top: 250, bottom: 294, left: 700, right: 900, width: 200 }, { width: 844, height: 320 });
  assert.equal(p.transform, 'translateY(-100%)');
});
test('keyboard viewport respects its offset and available space', () => {
  fits({ top: 390, bottom: 434, left: 300, right: 390, width: 90 }, { width: 390, height: 250, offsetTop: 200 }, { minWidth: 352, alignRight: true });
});
test('off-screen trigger does not force the menu off-screen', () => {
  fits({ top: -100, bottom: -56, left: -100, right: 100, width: 200 }, { width: 320, height: 240 });
});
