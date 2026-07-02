import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Trainer from '../models/Trainer.js';
import { buildTrainerSchedulesForDate } from '../utils/trainerScheduleView.js';
import { resolveTrainerScheduleCodes } from '../utils/trainerMappings.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const names = [/sharmila/i, /divya/i, /jahnavi/i];
for (const pattern of names) {
  const trainer = await Trainer.findOne({ name: pattern });
  if (!trainer) continue;
  const codes = resolveTrainerScheduleCodes(trainer);
  const schedules = await buildTrainerSchedulesForDate({
    trainerId: trainer._id,
    semester: 'III',
  });
  console.log(trainer.name, trainer.employeeId, 'codes:', codes, 'schedules:', schedules.length);
}

await mongoose.disconnect();
