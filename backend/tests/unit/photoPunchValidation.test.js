import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceMeters, validatePunchLocation, validatePunchJpeg } from '../../utils/photoPunchValidation.js';
const campus = { latitude: 13.621069, longitude: 79.289828 };
const now = Date.now();
const location = { ...campus, accuracy: 10, timestamp: now };
test('geofence checks distance, uncertainty, freshness and malformed GPS', () => {
  assert.equal(distanceMeters(campus, campus), 0);
  assert.equal(validatePunchLocation(location, campus, now), 0);
  assert.throws(() => validatePunchLocation({...location, latitude: campus.latitude + .02}, campus, now), /1.5 km/);
  assert.throws(() => validatePunchLocation({...location, accuracy: 101}, campus, now), /accuracy/);
  assert.throws(() => validatePunchLocation({...location, timestamp: now - 60001}, campus, now), /expired/);
  assert.throws(() => validatePunchLocation({...location, timestamp: now + 11000}, campus, now), /expired/);
  assert.throws(() => validatePunchLocation({...location, latitude: '13'}, campus, now), /Invalid/);
  assert.throws(() => validatePunchLocation({...location, longitude: 181}, campus, now), /Invalid/);
  assert.throws(() => validatePunchLocation({...location, accuracy: -1}, campus, now), /accuracy/);
});
test('JPEG checks reject bad framing, truncated segments and undersized photos', () => {
  assert.throws(() => validatePunchJpeg(Buffer.from('not a photo')), /JPEG/);
  const jpeg = Buffer.alloc(1100); jpeg.writeUInt16BE(0xffd8, 0); jpeg.writeUInt16BE(0xffc0, 2);
  jpeg.writeUInt16BE(17, 4); jpeg[6] = 8; jpeg.writeUInt16BE(480, 7); jpeg.writeUInt16BE(640, 9);
  jpeg.writeUInt16BE(0xffd9, jpeg.length - 2);
  assert.deepEqual(validatePunchJpeg(jpeg), {width: 640, height: 480});
  jpeg.writeUInt16BE(100, 9); assert.throws(() => validatePunchJpeg(jpeg), /malformed/);
  jpeg.writeUInt16BE(2000, 4); assert.throws(() => validatePunchJpeg(jpeg), /malformed/);
});
