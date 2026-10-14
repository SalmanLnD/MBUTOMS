import { toAttendanceDateKey } from './attendanceTracking.js';

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export const LATE_PUNCH_CUTOFF_SECONDS = 8 * 3600 + 40 * 60;
export const LATE_PUNCH_SOURCES = ['whatsapp', 'toms_camera'];
export const LATE_MISCONDUCT_START = '2026-10-14';

export const campusLocation = (env = process.env) => ({
  latitude: Number(env.PUNCH_CAMPUS_LATITUDE) || 13.621069,
  longitude: Number(env.PUNCH_CAMPUS_LONGITUDE) || 79.289828,
  radiusMeters: Number(env.PUNCH_CAMPUS_RADIUS_METERS) || 1500,
});

/** Seconds after midnight in Asia/Kolkata. India has no daylight-saving shift. */
export const istClockSeconds = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return shifted.getUTCHours() * 3600 + shifted.getUTCMinutes() * 60 + shifted.getUTCSeconds();
};

/** True when the punch instant is later than 8:40 AM India time. 8:40:00 is on time. */
export const isLatePunch = (value) => {
  const seconds = istClockSeconds(value);
  return seconds != null && seconds > LATE_PUNCH_CUTOFF_SECONDS;
};

/** Late misconduct starts on 14 Oct 2026. Earlier attendance days are left out. */
export const isLateMisconductDate = (value) => {
  const key = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : toAttendanceDateKey(value);
  return Boolean(key) && key >= LATE_MISCONDUCT_START;
};

export const haversineMeters = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const punchDistanceFromCampus = (photoPunch, env = process.env) => {
  const latitude = Number(photoPunch?.latitude);
  const longitude = Number(photoPunch?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const campus = campusLocation(env);
  const meters = haversineMeters(latitude, longitude, campus.latitude, campus.longitude);
  const accuracy = Number(photoPunch?.accuracy);
  return {
    distanceMeters: Math.round(meters),
    accuracyMeters: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
    onCampus: meters <= campus.radiusMeters,
    radiusMeters: campus.radiusMeters,
  };
};

/** The first confirmed late mark in a month is a warning. Each later mark is misconduct. */
export const lateMarkOutcome = (priorMarkedCount) => (
  Number(priorMarkedCount) > 0 ? 'misconduct' : 'warning'
);
