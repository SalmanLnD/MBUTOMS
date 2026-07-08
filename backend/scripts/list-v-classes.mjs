import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ClassGroup from '../models/ClassGroup.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const classes = await ClassGroup.find({ currentSemester: 'V' })
  .select('department section label')
  .sort({ department: 1, section: 1 });

const wanted = classes.filter((cls) =>
  /ECE|EEE|EIE|CE-ME|DS3|DS DS3/.test(cls.label) || cls.department === 'DS'
);
console.log(wanted.map((c) => `${c.department} | ${c.section} | ${c.label}`).join('\n'));
await mongoose.disconnect();
