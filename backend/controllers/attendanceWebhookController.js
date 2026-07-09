import Trainer from '../models/Trainer.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import { normalizeDate } from '../utils/scheduleHelpers.js';
import { toDateKey } from '../utils/dateRange.js';
import { normalizePhone, isValidMobileKey } from '../utils/phone.js';
import { TRAINER_ATTENDANCE_TRACKING_START } from '../utils/attendanceTracking.js';
import { clearAttendanceGridCache } from '../utils/attendanceGridCache.js';
import {
  applyItOifAttendanceRules,
  isItOif,
  IT_MOCK_PREP_HOURS,
} from '../utils/attendanceOifRules.js';

const findTrainerByPhone = async (phone) => {
  const target = normalizePhone(phone);
  if (!isValidMobileKey(target)) return null;

  const trainers = await Trainer.find({ phone: { $nin: ['', null] } })
    .select('name employeeId phone');

  return trainers.find(
    (trainer) => isValidMobileKey(trainer.phone) && normalizePhone(trainer.phone) === target
  ) || null;
};

/**
 * Machine-to-machine endpoint used by the WhatsApp bridge bot.
 * Auth is via the `x-webhook-secret` header (see WHATSAPP_WEBHOOK_SECRET),
 * not a user JWT, so it does not sit behind `protect`.
 */
export const recordWhatsappPunchIn = async (req, res) => {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).json({ message: 'Punch-in webhook is not configured' });
  }
  if (req.headers['x-webhook-secret'] !== secret) {
    return res.status(401).json({ message: 'Invalid webhook secret' });
  }

  const { phone, oifNumber, punchInAt, imageUrl } = req.body || {};

  if (!phone) {
    return res.status(400).json({ message: 'phone is required' });
  }
  if (!oifNumber || !String(oifNumber).trim()) {
    return res.status(400).json({ message: 'oifNumber is required' });
  }

  const trimmedOif = String(oifNumber).trim();
  if (trimmedOif.length > 12) {
    return res.status(400).json({ message: 'OIF number must be 12 characters or fewer' });
  }

  const trainer = await findTrainerByPhone(phone);
  if (!trainer) {
    return res.status(404).json({
      message: 'No trainer found for this phone number',
      phone: normalizePhone(phone),
    });
  }

  const punchDate = punchInAt ? new Date(punchInAt) : new Date();
  if (Number.isNaN(punchDate.getTime())) {
    return res.status(400).json({ message: 'punchInAt is not a valid date' });
  }

  const day = normalizeDate(punchDate);
  if (day < TRAINER_ATTENDANCE_TRACKING_START) {
    return res.status(400).json({ message: 'Attendance tracking has not started for this date' });
  }

  const existing = await TrainerDailyAttendance.findOne({ trainer: trainer._id, date: day });

  const update = {
    trainer: trainer._id,
    date: day,
    oifNumber: trimmedOif,
    punchInSource: 'whatsapp',
    punchInRawPhone: String(phone),
  };
  if (imageUrl) update.punchInImageUrl = String(imageUrl);
  if (isItOif(trimmedOif)) {
    update.mockPrepHours = IT_MOCK_PREP_HOURS;
  }

  // First punch of the day wins; later messages only backfill a missing time.
  if (!existing?.punchInAt) {
    update.punchInAt = punchDate;
  }

  const record = await TrainerDailyAttendance.findOneAndUpdate(
    { trainer: trainer._id, date: day },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  clearAttendanceGridCache();

  return res.status(existing ? 200 : 201).json({
    status: existing ? 'updated' : 'recorded',
    trainer: {
      _id: trainer._id,
      name: trainer.name,
      employeeId: trainer.employeeId,
    },
    date: toDateKey(day),
    oifNumber: record.oifNumber,
    punchInAt: record.punchInAt,
  });
};
