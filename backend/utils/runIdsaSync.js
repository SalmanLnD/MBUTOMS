import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { ensureReferenceData } from './seedReferenceData.js';
import { syncIdsaTrainersAndSubject } from './syncIdsaData.js';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await ensureReferenceData();
  const result = await syncIdsaTrainersAndSubject();
  console.log('IDSA sync completed:', result);
  process.exit(0);
};

run().catch((err) => {
  console.error('IDSA sync error:', err);
  process.exit(1);
});
