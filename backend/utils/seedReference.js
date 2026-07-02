import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { ensureReferenceData } from './seedReferenceData.js';

dotenv.config();

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB...');

  const counts = await ensureReferenceData();
  console.log('Reference data ready:');
  console.log(`  Schools: ${counts.schoolCount}`);
  console.log(`  Semesters: ${counts.semesterCount}`);
  console.log(`  Departments: ${counts.departmentCount}`);
  process.exit(0);
};

seed().catch((err) => {
  console.error('Reference seed error:', err);
  process.exit(1);
});
