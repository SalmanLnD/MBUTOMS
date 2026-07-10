import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Trainer from '../models/Trainer.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const searchTerms = ['Salman', 'Jahnavi', 'Mangalagiri'];
  for (const term of searchTerms) {
    const trainers = await Trainer.find({ name: { $regex: term, $options: 'i' } })
      .select('name phone employeeId');
    console.log(`\n=== ${term} (${trainers.length}) ===`);
    for (const t of trainers) {
      console.log('trainer:', t.name, t.phone, t.employeeId);
      const recs = await TrainerDailyAttendance.find({ trainer: t._id })
        .sort({ updatedAt: -1 })
        .limit(5);
      recs.forEach((r) => {
        console.log('  ', {
          date: r.date?.toISOString(),
          oif: r.oifNumber,
          punchInAt: r.punchInAt?.toISOString() || null,
          source: r.punchInSource,
          raw: r.punchInRawPhone,
          updatedAt: r.updatedAt?.toISOString(),
        });
      });
    }
  }

  const recent = await TrainerDailyAttendance.find({
    $or: [
      { updatedAt: { $gte: new Date('2026-07-09T09:00:00.000Z') } },
      { punchInAt: { $gte: new Date('2026-07-09T09:00:00.000Z') } },
    ],
  })
    .populate('trainer', 'name phone')
    .sort({ updatedAt: -1 });

  console.log('\n=== All activity since ~2:30 PM IST ===');
  recent.forEach((r) => {
    console.log(
      r.trainer?.name,
      '| oif:', r.oifNumber,
      '| punch:', r.punchInAt?.toISOString() || 'none',
      '| source:', r.punchInSource,
      '| updated:', r.updatedAt?.toISOString()
    );
  });

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
