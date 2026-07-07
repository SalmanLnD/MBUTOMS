import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Subject from '../models/Subject.js';
import { migrateSubjectSlotProfiles } from '../controllers/subjectController.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const result = await migrateSubjectSlotProfiles();
const subjects = await Subject.find({
  code: {
    $in: [
      '22CS102037',
      '22CS102033',
      '22CS102034',
      '25CA202009',
      '22CA102006',
      '22LG101703',
    ],
  },
}).select('code name slotCount slotTimings');

console.log('Migration:', result);
console.log(JSON.stringify(subjects, null, 2));
await mongoose.disconnect();
