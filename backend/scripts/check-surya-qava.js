import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const surya = await Trainer.findOne({ employeeId: '135887' });
const qavaSubjects = await Subject.find({
  $or: [{ name: /qava/i }, { code: /qava/i }],
});

console.log('Suryadeo subjects array:', surya?.subjects);
console.log('QAVA subjects:', qavaSubjects.map((s) => ({
  id: s._id,
  name: s.name,
  code: s.code,
  trainerEligible: s.trainerEligible?.map(String),
})));

const eligible = await Subject.find({ trainerEligible: surya?._id });
console.log('Subjects where Suryadeo is trainerEligible:', eligible.map((s) => s.name));

await mongoose.disconnect();
