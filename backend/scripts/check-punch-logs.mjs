import 'dotenv/config';
import mongoose from 'mongoose';
import Trainer from '../models/Trainer.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import { normalizePhone } from '../utils/phone.js';

await mongoose.connect(process.env.MONGODB_URI);

const target = normalizePhone('9080333594');
const trainers = await Trainer.find({ phone: { $nin: ['', null] } }).select('name employeeId phone');
const match = trainers.filter((t) => normalizePhone(t.phone) === target);

console.log('targetPhone', target);
console.log('matchedTrainers', JSON.stringify(match, null, 2));

if (match[0]) {
  const allRecords = await TrainerDailyAttendance.find({ trainer: match[0]._id }).sort({ date: -1 });
  console.log('allAttendanceRecords', JSON.stringify(allRecords, null, 2));
}

const recent = await TrainerDailyAttendance.find({
  punchInAt: { $exists: true, $ne: null },
})
  .sort({ punchInAt: -1 })
  .limit(8)
  .populate('trainer', 'name employeeId phone');

console.log(
  'recentPunchIns',
  recent.map((r) => ({
    name: r.trainer?.name,
    phone: r.trainer?.phone,
    raw: r.punchInRawPhone,
    oif: r.oifNumber,
    punchInAt: r.punchInAt,
    date: r.date,
  }))
);

await mongoose.disconnect();
