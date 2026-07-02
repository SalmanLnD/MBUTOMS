import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Trainer from '../models/Trainer.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const collection = mongoose.connection.collection('trainers');
const before = await collection.find({ email: { $exists: true, $in: [null, ''] } }).toArray();
console.log('Stored null/empty emails before:', before.length, before);

await collection.updateMany(
  { email: { $exists: true, $in: [null, ''] } },
  { $unset: { email: '' } }
);

const after = await collection.find({ email: { $exists: true, $in: [null, ''] } }).toArray();
console.log('Stored null/empty emails after:', after.length);

await mongoose.disconnect();
