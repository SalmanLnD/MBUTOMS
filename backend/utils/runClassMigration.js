import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { migrateClassesFromSchedules } from './migrateClassesFromSchedules.js';
import { repairClassIndexesAndPy } from './repairClassIndexesAndPy.js';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await repairClassIndexesAndPy();
  const result = await migrateClassesFromSchedules();
  console.log('Class migration complete:', result);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
