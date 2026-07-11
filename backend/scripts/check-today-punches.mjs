import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Trainer from '../models/Trainer.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import { toAttendanceDateKey, normalizeAttendanceDate } from '../utils/attendanceTracking.js';

dotenv.config();

const searchTerms = [
  'mahendra',
  'meghasree',
  'sumit',
  'suraydeo',
  'suryadeo',
  'rahamthulla',
  'rahmath',
  'saipriya',
  'lavanya',
  'navya',
  'jahnavi',
  'praharsha',
  'prharsha',
  'sharmila',
  'vasanth',
];

await mongoose.connect(process.env.MONGODB_URI);

const todayKey = toAttendanceDateKey(new Date());
const today = normalizeAttendanceDate(new Date());
console.log('Today IST key:', todayKey);

const seen = new Set();
for (const term of searchTerms) {
  const trainers = await Trainer.find({ name: { $regex: term, $options: 'i' } })
    .select('name phone employeeId');
  for (const trainer of trainers) {
    const key = trainer._id.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    const rec = await TrainerDailyAttendance.findOne({ trainer: trainer._id, date: today });
    console.log(JSON.stringify({
      name: trainer.name,
      phone: trainer.phone,
      employeeId: trainer.employeeId,
      todayOif: rec?.oifNumber || null,
      punchInAt: rec?.punchInAt?.toISOString() || null,
      source: rec?.punchInSource || null,
      raw: rec?.punchInRawPhone || null,
    }));
  }
}

const todayPunches = await TrainerDailyAttendance.find({
  date: today,
  punchInAt: { $exists: true, $ne: null },
})
  .populate('trainer', 'name')
  .sort({ punchInAt: -1 });

console.log(`\nAll punch-ins for today: ${todayPunches.length}`);
todayPunches.forEach((record) => {
  console.log(
    record.trainer?.name,
    record.punchInAt?.toISOString(),
    record.oifNumber,
    record.punchInSource
  );
});

const recentWhatsapp = await TrainerDailyAttendance.find({ punchInSource: 'whatsapp' })
  .sort({ punchInAt: -1 })
  .limit(20)
  .populate('trainer', 'name');

console.log('\nLast 20 WhatsApp punches overall:');
recentWhatsapp.forEach((record) => {
  console.log(
    record.trainer?.name,
    toAttendanceDateKey(record.date),
    record.punchInAt?.toISOString(),
    record.oifNumber
  );
});

await mongoose.disconnect();
