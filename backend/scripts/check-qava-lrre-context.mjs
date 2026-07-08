import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ClassGroup from '../models/ClassGroup.js';
import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';
import Schedule from '../models/Schedule.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const employeeIds = ['135887', '135130', '135621', '136047', '135517', '801406', '135402'];

const trainers = await Trainer.find({ employeeId: { $in: employeeIds } })
  .select('name employeeId scheduleTrainerCodes subjects');

const subjects = await Subject.find({
  code: { $in: ['22LG101702', '22LG101703'] },
}).select('code name trainerEligible');

const bcaClasses = await ClassGroup.find({ department: /BCA|BCS/i }).select('department section label currentSemester');
const lrreClasses = await ClassGroup.find({
  $or: [
    { department: { $in: ['CSE', 'AIML', 'DS', 'CS', 'IT', 'ECE & EIE', 'EEE', 'CE & ME'] } },
    { section: /ECE|EEE|EIE|CE-ME|DS/ },
  ],
  currentSemester: { $in: ['III', 'V'] },
}).select('department section label currentSemester').sort({ department: 1, section: 1 });

const schedCounts = await Promise.all(
  employeeIds.map(async (id) => ({
    employeeId: id,
    count: await Schedule.countDocuments({ trainerCode: id }),
  }))
);

console.log(JSON.stringify({ trainers, subjects, bcaClasses, schedCounts, lrreClassCount: lrreClasses.length }, null, 2));
console.log('LRRE V classes sample:', lrreClasses.slice(0, 40).map((c) => c.label));
await mongoose.disconnect();
