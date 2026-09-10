import connectDB from '../config/db.js';
import Subject from '../models/Subject.js';

const run = async () => {
  try {
    await connectDB();
    const subs = await Subject.find({}).select('name oifNumber code startDate endDate').lean();
    subs.forEach((s) => {
      console.log(`${s.oifNumber || '-'} | ${s.code} | start:${s.startDate ? s.startDate.toISOString().split('T')[0] : '-'} | end:${s.endDate ? s.endDate.toISOString().split('T')[0] : '-'} | ${s.name}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err && err.message);
    process.exit(1);
  }
};

run();
