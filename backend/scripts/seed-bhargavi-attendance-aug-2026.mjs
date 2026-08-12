/**
 * One-off: set Padarthi Bhargavi joining date to 1 Aug 2026 and seed attendance 1–10 Aug.
 * Run: node scripts/seed-bhargavi-attendance-aug-2026.mjs
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import Trainer from '../models/Trainer.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import { TRAINER_ATTENDANCE_TYPES } from '../utils/trainerAttendanceTypes.js';
import { normalizeAttendanceDate } from '../utils/attendanceTracking.js';
import {
  applyItOifAttendanceRules,
  allowsManualClassHandlingHours,
  isItOif,
} from '../utils/attendanceOifRules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const JOINING_DATE = normalizeAttendanceDate('2026-08-01');

/** Column 1 = OIF number, 2 = mock hrs, 3 = class hours. Food allowance = none. */
const ATTENDANCE_ROWS = [
  { date: '2026-08-01', oifNumber: 'CA26808', mockPrepHours: 0, classHandlingHours: 6 },
  { date: '2026-08-02', oifNumber: 'HD-CT27001', mockPrepHours: 0, classHandlingHours: 0 },
  { date: '2026-08-03', oifNumber: 'CT27001', mockPrepHours: 0, classHandlingHours: 6 },
  { date: '2026-08-04', oifNumber: 'CT27001', mockPrepHours: 0, classHandlingHours: 6 },
  { date: '2026-08-05', oifNumber: 'CT27001', mockPrepHours: 0, classHandlingHours: 6 },
  { date: '2026-08-06', oifNumber: 'CT27001', mockPrepHours: 0, classHandlingHours: 6 },
  { date: '2026-08-07', oifNumber: 'CT27001', mockPrepHours: 0, classHandlingHours: 6 },
  { date: '2026-08-08', oifNumber: 'CT27001', mockPrepHours: 0, classHandlingHours: 0 },
  { date: '2026-08-09', oifNumber: 'TI27125', mockPrepHours: 0, classHandlingHours: 6 },
  { date: '2026-08-10', oifNumber: 'HD-CT27006', mockPrepHours: 0, classHandlingHours: 0 },
];

const resolveAttendanceType = (oifNumber) => {
  const value = String(oifNumber || '').trim().toUpperCase();
  if (value.startsWith('HD-')) {
    return TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF;
  }
  return TRAINER_ATTENDANCE_TYPES.OIF;
};

const resolveStoredOifNumber = (oifNumber, attendanceType) => {
  const trimmed = String(oifNumber || '').trim();
  if (attendanceType === TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF && trimmed.toUpperCase().startsWith('HD-')) {
    return trimmed.slice(3);
  }
  return trimmed;
};

const buildAttendanceRecord = async (trainerId, row) => {
  const day = normalizeAttendanceDate(row.date);
  const attendanceType = resolveAttendanceType(row.oifNumber);
  const oifNumber = resolveStoredOifNumber(row.oifNumber, attendanceType);
  const { mockPrepHours } = applyItOifAttendanceRules({
    oifNumber,
    mockPrepHours: row.mockPrepHours,
    classHandlingHours: row.classHandlingHours,
  });

  let storedClassHandlingHours = null;

  if (attendanceType === TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF) {
    storedClassHandlingHours = Number(row.classHandlingHours ?? 0);
  } else if (isItOif(oifNumber)) {
    storedClassHandlingHours = null;
  } else if (allowsManualClassHandlingHours(oifNumber)) {
    storedClassHandlingHours = Number(row.classHandlingHours ?? 0);
  } else if (!row.classHandlingHours) {
    storedClassHandlingHours = 0;
  } else {
    storedClassHandlingHours = null;
  }

  return {
    trainer: trainerId,
    date: day,
    attendanceType,
    oifNumber,
    mockPrepHours,
    classHandlingHours: storedClassHandlingHours,
    foodAllowance: '',
  };
};

const findBhargavi = async () => {
  const byName = await Trainer.findOne({
    name: { $regex: /bhargavi|padarthi/i },
  }).select('name employeeId joiningDate');

  if (byName) return byName;

  return Trainer.findOne({ name: /Padarthi/i }).select('name employeeId joiningDate');
};

const main = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const trainer = await findBhargavi();
  if (!trainer) {
    throw new Error('Trainer Padarthi Bhargavi not found');
  }

  console.log(`Found trainer: ${trainer.name} (${trainer.employeeId})`);

  trainer.joiningDate = JOINING_DATE;
  await trainer.save();
  console.log(`Set joiningDate to ${JOINING_DATE.toISOString().slice(0, 10)}`);

  for (const row of ATTENDANCE_ROWS) {
    const payload = await buildAttendanceRecord(trainer._id, row);
    await TrainerDailyAttendance.findOneAndUpdate(
      { trainer: trainer._id, date: payload.date },
      { $set: payload },
      { upsert: true, new: true }
    );
    console.log(`Upserted ${row.date}: ${row.oifNumber} mock=${row.mockPrepHours} class=${row.classHandlingHours}`);
  }

  console.log('Done.');
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
