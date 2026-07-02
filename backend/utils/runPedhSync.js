import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { syncPedhTrainersAndSubject } from './syncPedhData.js';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await syncPedhTrainersAndSubject();
  console.log('PEDH sync complete:', result);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
