import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { migrateTrainerEmailOptional } from '../utils/migrateTrainerEmailOptional.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);
const result = await migrateTrainerEmailOptional();
console.log(result);
await mongoose.disconnect();
