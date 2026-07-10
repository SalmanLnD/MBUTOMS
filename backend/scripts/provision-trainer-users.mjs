import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Trainer from '../models/Trainer.js';
import User from '../models/User.js';
import { syncTrainerUser } from '../utils/trainerUserSync.js';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const trainers = await Trainer.find({ email: { $nin: ['', null] } });
  let created = 0;
  let updated = 0;

  for (const trainer of trainers) {
    const before = await User.findOne({ trainer: trainer._id });
    await syncTrainerUser(trainer, { resetPassword: true });
    if (before) updated += 1;
    else created += 1;
  }

  console.log(JSON.stringify({ total: trainers.length, created, updated }, null, 2));
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
