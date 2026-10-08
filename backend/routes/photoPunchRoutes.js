import express from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
import { networkCheck } from '../services/punchNetworkCheck.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validatePunchJpeg, validatePunchLocation } from '../utils/photoPunchValidation.js';
import { driveConfigured, uploadPunchPhoto } from '../services/punchPhotoDrive.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import { toAttendanceDateKey, normalizeAttendanceDate } from '../utils/attendanceTracking.js';
import { clearAttendanceGridCache } from '../utils/attendanceGridCache.js';
import { computeClassHandlingHoursBatch } from '../utils/trainerClassHoursBatch.js';
import { resolvePhotoPunchOif } from '../utils/photoPunchOif.js';
import Subject from '../models/Subject.js';
import { allowsLocalPunchTrial } from '../utils/photoPunchNetworkPolicy.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2 } });
const scheduledOif = async (user, capturedAt) => {
  if (!user.trainer) return resolvePhotoPunchOif();
  const date = normalizeAttendanceDate(toAttendanceDateKey(capturedAt));
  const rows = await computeClassHandlingHoursBatch([user.trainer], [date], null, null, { includeDetails: true });
  const scheduled = rows.get(`${String(user.trainer)}|${toAttendanceDateKey(date)}`) || {};
  const ids = (scheduled.schedules || []).map(s => s.subject).filter(Boolean);
  const subjects = ids.length ? await Subject.find({ _id: { $in: ids } }).select('oifNumber').lean() : [];
  const byId = new Map(subjects.map(s => [String(s._id), s.oifNumber]));
  return resolvePhotoPunchOif({}, { ...scheduled, schedules: (scheduled.schedules || []).map(s => ({ ...s, oifNumber: byId.get(String(s.subject)) })) });
};
const config = () => {
  const campus = { latitude: Number(process.env.PUNCH_CAMPUS_LATITUDE ?? 13.621069), longitude: Number(process.env.PUNCH_CAMPUS_LONGITUDE ?? 79.289828) };
  const campusVerified = Number.isFinite(campus.latitude) && Math.abs(campus.latitude) <= 90 && Number.isFinite(campus.longitude) && Math.abs(campus.longitude) <= 180;
  return { mode: 'live', enabled: process.env.PUNCH_ATTENDANCE_ENABLED !== 'false', campus, campusVerified,
    driveConnected: driveConfigured(), networkCheckConfigured: Boolean(process.env.PUNCH_PROXYCHECK_API_KEY), radiusMeters: 1500 };
};
const setupIssues = (req, settings) => {
  const issues = [];
  if (!settings.campusVerified) issues.push('Campus coordinates are invalid in the backend settings.');
  if (!settings.driveConnected) issues.push('Add PUNCH_GOOGLE_CLIENT_ID, PUNCH_GOOGLE_CLIENT_SECRET and PUNCH_GOOGLE_REFRESH_TOKEN to the backend hosting environment.');
  if (!settings.networkCheckConfigured && !allowsLocalPunchTrial(req)) issues.push('Add PUNCH_PROXYCHECK_API_KEY to the backend hosting environment. The local trial exception does not apply to hosted traffic.');
  if (!req.user.trainer) issues.push('Link your admin account to its trainer record.');
  return issues;
};
router.use(protect);
router.use((req, res, next) => {
  if (req.user.role !== 'admin' || req.impersonator || req.hasDemoToken) return res.status(403).json({ message: 'Photo punch-in is currently available to administrators only.' });
  if (!config().enabled) return res.status(503).json({ message: 'Photo punch-in is disabled by the administrator.' });
  if (req.user.mustResetPassword || req.user.requiresPasswordReset) return res.status(403).json({ message: 'Complete your password reset before punching in.' });
  next();
});
router.get('/config', (req, res) => res.json({ ...config(), linkedTrainer: Boolean(req.user.trainer), networkDetectionLimit: 'VPN checks use IP reputation and cannot detect every VPN or spoofed GPS reading.' }));
router.get('/scheduled-oif', asyncHandler(async (req, res) => res.json(await scheduledOif(req.user, new Date().toISOString()))));
router.post('/capture-session', asyncHandler(async (req, res) => {
  if (req.impersonator || req.hasDemoToken) return res.status(403).json({ message: 'Use your own account for photo punch-in.' });
  const settings = config();
  const issues = setupIssues(req, settings);
  if (issues.length) return res.status(503).json({ message: issues.join(' '), setupIssues: issues });
  let distance;
  try { distance = validatePunchLocation(req.body.location, settings.campus); } catch (error) { return res.status(400).json({ message: error.message }); }
  const network = await networkCheck(req);
  if (network === 'blocked') return res.status(403).json({ message: 'VPN or proxy detected. Turn it off before taking a photo.' });
  if (settings.mode === 'live' && network !== 'clear' && !allowsLocalPunchTrial(req)) return res.status(503).json({ message: 'Network check could not verify this connection. Photo capture is blocked; retry without VPN.' });
  const capturedAt = new Date().toISOString();
  const token = jwt.sign({ purpose: 'photo-punch', userId: String(req.user._id), trainerId: String(req.user.trainer || ''),
    location: req.body.location, mode: settings.mode, capturedAt, nonce: randomUUID() }, process.env.JWT_SECRET, { expiresIn: '2m' });
  res.json({ token, capturedAt, distance, network, mode: settings.mode, location: req.body.location });
}));
router.post('/submit', upload.single('photo'), asyncHandler(async (req, res) => {
  if (req.impersonator || req.hasDemoToken) return res.status(403).json({ message: 'Use your own account for photo punch-in.' });
  let session;
  try {
    session = jwt.verify(req.body.token, process.env.JWT_SECRET);
    if (session.purpose !== 'photo-punch' || session.userId !== String(req.user._id) || session.trainerId !== String(req.user.trainer || '')) throw new Error();
  } catch { return res.status(400).json({ message: 'Capture expired. Retake the photo.' }); }
  const settings = config();
  if (settings.mode !== session.mode) return res.status(400).json({ message: 'Punch-in mode changed. Retake the photo.' });
  try { validatePunchJpeg(req.file?.buffer); validatePunchLocation({ ...session.location, timestamp: new Date(session.capturedAt).getTime() }, settings.campus); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  const day = toAttendanceDateKey(session.capturedAt);
  let assignment;
  try {
    const input = req.body.assignment ? JSON.parse(req.body.assignment) : {};
    assignment = !input.mode || input.mode === 'scheduled' ? await scheduledOif(req.user, session.capturedAt) : resolvePhotoPunchOif(input);
  } catch (error) { return res.status(400).json({ message: error.message }); }
  const issues = setupIssues(req, settings);
  if (issues.length) return res.status(503).json({ message: issues.join(' '), setupIssues: issues });
  const network = await networkCheck(req);
  if (network === 'blocked' || (network !== 'clear' && !allowsLocalPunchTrial(req))) return res.status(403).json({ message: 'Connection could not be verified. Turn off VPN and retry.' });
  const date = normalizeAttendanceDate(day);
  const existing = await TrainerDailyAttendance.findOne({ trainer: req.user.trainer, date }).select('punchInAt attendanceType').lean();
  if (existing?.punchInAt) return res.status(409).json({ message: 'You have already punched in today.' });
  if (existing && existing.attendanceType !== 'oif') return res.status(409).json({ message: 'An attendance or leave entry already exists for today. Ask an administrator to review it before punching in.' });
  const photo = await uploadPunchPhoto({ buffer: req.file.buffer, name: `${String(req.user.trainer)}-${session.nonce}.jpg`, day });
  try {
    await TrainerDailyAttendance.findOneAndUpdate({ trainer: req.user.trainer, date, punchInAt: { $exists: false }, attendanceType: 'oif' }, {
      $set: { ...assignment, punchInAt: new Date(session.capturedAt), punchInSource: 'toms_camera', punchInImageUrl: photo.webViewLink || `https://drive.google.com/file/d/${photo.id}/view`,
        photoPunch: { driveFileId: photo.id, latitude: session.location.latitude, longitude: session.location.longitude, accuracy: session.location.accuracy,
          sha256: createHash('sha256').update(req.file.buffer).digest('hex') }, markedBy: req.user._id },
      $setOnInsert: { attendanceType: 'oif' },
    }, { upsert: true, new: true, runValidators: true });
  } catch (error) {
    // A competing punch-in wins; never overwrite an existing punch or leave record.
    return res.status(error.code === 11000 ? 409 : 503).json({ message: 'Photo uploaded but attendance could not be saved. Contact an administrator before retrying.', driveFileId: photo.id });
  }
  clearAttendanceGridCache();
  res.json({ assignment, message: 'Punch-in recorded.', folder: `toms punch ins/${day}`, photoUrl: photo.webViewLink || `https://drive.google.com/file/d/${photo.id}/view` });
}));
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ message: 'Upload one JPEG camera photo under 5 MB.' });
  next(error);
});
export default router;
