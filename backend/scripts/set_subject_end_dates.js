import connectDB from '../config/db.js';
import Subject from '../models/Subject.js';

// match by `oifNumber` field (OIF numbers like CT27008 shown in UI)
const specialOif = ['CT27007', 'CT27008', 'CT27009'];
const specialEnd = new Date(Date.UTC(2026, 10, 10)); // 10 Nov 2026 UTC
const defaultEnd = new Date(Date.UTC(2026, 10, 6)); // 06 Nov 2026 UTC

const run = async () => {
  try {
    await connectDB();
    console.log('Connected to DB; updating subject end dates...');

    const res1 = await Subject.updateMany(
      { oifNumber: { $in: specialOif } },
      { $set: { endDate: specialEnd } }
    );
    console.log(`Updated ${res1.modifiedCount || res1.nModified || 0} special subject(s)`);

    const res2 = await Subject.updateMany(
      { oifNumber: { $nin: specialOif } },
      { $set: { endDate: defaultEnd } }
    );
    console.log(`Updated ${res2.modifiedCount || res2.nModified || 0} other subject(s)`);

    process.exit(0);
  } catch (err) {
    console.error('ERROR updating subjects', err && err.message);
    process.exit(1);
  }
};

run();
