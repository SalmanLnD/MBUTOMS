import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Trainer from '../models/Trainer.js';
import { buildTrainerSchedulesForDate } from '../utils/trainerScheduleView.js';
import { clearEmployeeTimetableSchedules, EMPLOYEE_IDS_WITHOUT_TIMETABLE } from '../utils/clearEmployeeTimetableSchedules.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const cleanup = await clearEmployeeTimetableSchedules();
console.log('Deleted direct schedules:', cleanup.deletedCount);

for (const employeeId of EMPLOYEE_IDS_WITHOUT_TIMETABLE) {
  const trainer = await Trainer.findOne({ employeeId });
  if (!trainer) {
    console.log(employeeId, 'no trainer record', 'visible: 0');
    continue;
  }
  const visible = await buildTrainerSchedulesForDate({
    trainerId: trainer._id,
    semester: 'III',
  });
  console.log(employeeId, trainer.name, 'visible:', visible.length);
}

await mongoose.disconnect();
