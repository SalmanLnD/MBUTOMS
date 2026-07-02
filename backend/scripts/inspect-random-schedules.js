import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Trainer from '../models/Trainer.js';
import Schedule from '../models/Schedule.js';
import { resolveTrainerScheduleCodes } from '../utils/trainerMappings.js';
import { buildTrainerSchedulesForDate } from '../utils/trainerScheduleView.js';

dotenv.config();

const EMPLOYEE_IDS = [
  '135310',
  '135402',
  '135517',
  '135621',
  '135887',
  '136047',
  '801406',
];

await mongoose.connect(process.env.MONGODB_URI);

const trainers = await Trainer.find({ employeeId: { $in: EMPLOYEE_IDS } });

for (const trainer of trainers) {
  const codes = resolveTrainerScheduleCodes(trainer);
  const legacyCodes = codes.filter((code) => code !== trainer.employeeId);
  const visible = await buildTrainerSchedulesForDate({
    trainerId: trainer._id,
    semester: 'III',
  });
  console.log({
    employeeId: trainer.employeeId,
    name: trainer.name,
    codes,
    legacyCodes,
    visibleCount: visible.length,
  });
}

const directSchedules = await Schedule.find({
  trainerCode: { $in: EMPLOYEE_IDS },
});
console.log('\nDirect schedules under employee IDs:', directSchedules.length);

await mongoose.disconnect();
