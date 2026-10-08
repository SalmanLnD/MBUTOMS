export const distanceMeters = (a, b) => {
  const rad = value => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
export const validatePunchLocation = (location, campus, now = Date.now()) => {
  if (!location || ![location.latitude, location.longitude, location.accuracy, location.timestamp].every(Number.isFinite)
    || Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) throw new Error('Invalid GPS reading.');
  if (location.timestamp > now + 10000 || now - location.timestamp > 60000) throw new Error('Location expired. Refresh GPS and retake the photo.');
  if (location.accuracy < 0 || location.accuracy > 100) throw new Error('GPS accuracy must be within 100 metres. Move outdoors and retry.');
  const distance = distanceMeters(location, campus);
  if (distance + location.accuracy > 1500) throw new Error('You must be clearly within 1.5 km of campus. Move closer or improve GPS accuracy.');
  return Math.round(distance);
};
// Bound size and check JPEG framing/dimensions before forwarding transient bytes to Drive.
// This is file validation, not identity, liveness or GPS-spoof detection.
export const validatePunchJpeg = buffer => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 1000 || buffer.length > 5 * 1024 * 1024
    || buffer.readUInt16BE(0) !== 0xffd8 || buffer.readUInt16BE(buffer.length - 2) !== 0xffd9) throw new Error('A valid JPEG camera photo under 5 MB is required.');
  let offset = 2;
  while (offset + 4 < buffer.length) {
    if (buffer[offset++] !== 0xff) break;
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8) {
      const height = buffer.readUInt16BE(offset + 3), width = buffer.readUInt16BE(offset + 5);
      if (width < 320 || height < 240 || width * height > 12000000) break;
      return { width, height };
    }
    offset += length;
  }
  throw new Error('Photo is malformed or too small. Retake it with the camera.');
};
