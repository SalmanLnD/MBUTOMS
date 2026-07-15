import Trainer from '../models/Trainer.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import { normalizePhone, isValidMobileKey } from '../utils/phone.js';
import {
  normalizeAttendanceDate,
  toAttendanceDateKey,
  TRAINER_ATTENDANCE_TRACKING_START,
} from '../utils/attendanceTracking.js';
import { clearAttendanceGridCache } from '../utils/attendanceGridCache.js';
import {
  applyItOifAttendanceRules,
  isItOif,
  IT_MOCK_PREP_HOURS,
} from '../utils/attendanceOifRules.js';
import { TRAINER_ATTENDANCE_TYPES } from '../utils/trainerAttendanceTypes.js';

const findTrainerByPhone = async (phone) => {
  const target = normalizePhone(phone);
  if (!isValidMobileKey(target)) return null;

  // Fast path: indexed lookup on the derived phone key.
  const byKey = await Trainer.findOne({ phoneKey: target })
    .select('name employeeId phone')
    .lean();
  if (byKey) return byKey;

  // Legacy path for trainers created before phoneKey existed: scan once,
  // then backfill every key so the next lookup is indexed.
  const trainers = await Trainer.find({ phone: { $nin: ['', null] } })
    .select('name employeeId phone phoneKey')
    .lean();

  const backfill = trainers
    .filter((trainer) => (trainer.phoneKey || '') !== normalizePhone(trainer.phone))
    .map((trainer) => ({
      updateOne: {
        filter: { _id: trainer._id },
        update: { $set: { phoneKey: normalizePhone(trainer.phone) } },
      },
    }));
  if (backfill.length) {
    await Trainer.bulkWrite(backfill, { ordered: false });
  }

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

  const { phone, oifNumber, punchInAt, imageUrl, whatsappMessageId } = req.body || {};

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

  const messageId = whatsappMessageId ? String(whatsappMessageId).trim() : '';
  if (messageId) {
    const alreadyByMessage = await TrainerDailyAttendance.findOne({
      whatsappMessageIds: messageId,
    }).select('_id trainer date oifNumber punchInAt');
    if (alreadyByMessage) {
      return res.status(200).json({
        status: 'already_recorded',
        trainer: { _id: alreadyByMessage.trainer },
        date: toAttendanceDateKey(alreadyByMessage.date),
        oifNumber: alreadyByMessage.oifNumber,
        punchInAt: alreadyByMessage.punchInAt,
      });
    }
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

  const day = normalizeAttendanceDate(punchDate);
  if (day < TRAINER_ATTENDANCE_TRACKING_START) {
    return res.status(400).json({ message: 'Attendance tracking has not started for this date' });
  }

  const existing = await TrainerDailyAttendance.findOne({ trainer: trainer._id, date: day });

  const update = {
    trainer: trainer._id,
    date: day,
    attendanceType: TRAINER_ATTENDANCE_TYPES.OIF,
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

  const updateOps = { $set: update };
  if (messageId) {
    updateOps.$addToSet = { whatsappMessageIds: messageId };
  }

  const record = await TrainerDailyAttendance.findOneAndUpdate(
    { trainer: trainer._id, date: day },
    updateOps,
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
    date: toAttendanceDateKey(day),
    oifNumber: record.oifNumber,
    punchInAt: record.punchInAt,
  });
};
