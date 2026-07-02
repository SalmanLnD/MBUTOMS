import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Trainer from '../models/Trainer.js';
import { buildTrainerSchedulesForDate } from '../utils/trainerScheduleView.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const trainers = await Trainer.find({ status: 'active' }).sort({ employeeId: 1 });

for (const trainer of trainers) {
  const schedules = await buildTrainerSchedulesForDate({
    trainerId: trainer._id,
    semester: 'III',
  });
  if (schedules.length > 0) {
    console.log(trainer.employeeId, trainer.name, schedules.length);
  }
}

await mongoose.disconnect();
