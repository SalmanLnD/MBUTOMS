/**
 * One-time migration: normalize TrainerDailyAttendance.date to IST calendar days
 * stored as UTC midnight (YYYY-MM-DDT00:00:00.000Z).
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import { normalizeAttendanceDate, toAttendanceDateKey } from '../utils/attendanceTracking.js';

dotenv.config();

const mergeRecords = (target, source) => {
  const updates = {};

  if (!target.punchInAt && source.punchInAt) {
    updates.punchInAt = source.punchInAt;
    updates.punchInSource = source.punchInSource || 'whatsapp';
    updates.punchInRawPhone = source.punchInRawPhone || '';
    updates.punchInImageUrl = source.punchInImageUrl || '';
  }

  if (!String(target.oifNumber || '').trim() && String(source.oifNumber || '').trim()) {
    updates.oifNumber = source.oifNumber;
  }

  if ((target.mockPrepHours ?? 0) === 0 && (source.mockPrepHours ?? 0) > 0) {
    updates.mockPrepHours = source.mockPrepHours;
  }

  if (!target.markedBy && source.markedBy) {
    updates.markedBy = source.markedBy;
  }

  return updates;
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const records = await TrainerDailyAttendance.find().sort({ createdAt: 1 });
  let moved = 0;
  let merged = 0;

  for (const record of records) {
    const newDate = normalizeAttendanceDate(record.date);
    if (record.date.getTime() === newDate.getTime()) continue;

    const existing = await TrainerDailyAttendance.findOne({
      trainer: record.trainer,
      date: newDate,
      _id: { $ne: record._id },
    });

    if (existing) {
      const updates = mergeRecords(existing, record);
      if (Object.keys(updates).length) {
        await TrainerDailyAttendance.updateOne({ _id: existing._id }, { $set: updates });
      }
      await record.deleteOne();
      merged += 1;
      console.log(
        `merged ${record._id} (${toAttendanceDateKey(record.date)}) into ${existing._id}`
      );
      continue;
    }

    await TrainerDailyAttendance.updateOne({ _id: record._id }, { $set: { date: newDate } });
    moved += 1;
    console.log(
      `moved ${record._id}: ${record.date.toISOString()} -> ${newDate.toISOString()} (${toAttendanceDateKey(newDate)})`
    );
  }

  console.log(JSON.stringify({ moved, merged, total: records.length }, null, 2));
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
