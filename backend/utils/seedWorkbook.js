import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Trainer from '../models/Trainer.js';
import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Attendance from '../models/Attendance.js';
import { extractSchedulesFromWorkbook } from './parseWorkbook.js';
import { ensureReferenceData } from './seedReferenceData.js';
import { getTrainerDisplayName } from './trainerMappings.js';
import { syncIdsaTrainersAndSubject } from './syncIdsaData.js';
import { syncPedhTrainersAndSubject } from './syncPedhData.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.resolve(__dirname, '../data/schedules-iii-sem.json');

const slugify = (code) =>
  code.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB...');

  const referenceCounts = await ensureReferenceData();
  console.log(`Reference data: ${referenceCounts.schoolCount} schools, ${referenceCounts.semesterCount} semesters, ${referenceCounts.departmentCount} departments`);

  let schedules;
  let trainerCodes;

  if (fs.existsSync(jsonPath)) {
    schedules = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    trainerCodes = [...new Set(schedules.map((s) => s.trainerCode))];
    console.log(`Loaded ${schedules.length} schedules from JSON`);
  } else {
    const extracted = await extractSchedulesFromWorkbook();
    schedules = extracted.schedules;
    trainerCodes = extracted.trainerCodes;
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(schedules, null, 2));
    console.log(`Extracted and saved ${schedules.length} schedules from workbook`);
  }

  await Promise.all([
    User.deleteMany({ role: 'trainer' }),
    Trainer.deleteMany(),
    Schedule.deleteMany(),
    Leave.deleteMany(),
    Attendance.deleteMany(),
  ]);

  const trainers = await Trainer.insertMany(
    trainerCodes.map((code) => ({
      employeeId: code,
      name: getTrainerDisplayName(code),
      email: `${slugify(code)}@toms.edu`,
      phone: '0000000000',
      skills: [],
      experience: 0,
      performanceScore: 80,
    }))
  );

  await Schedule.insertMany(schedules);
  await syncIdsaTrainersAndSubject();
  await syncPedhTrainersAndSubject();

  const adminExists = await User.findOne({ email: 'admin@toms.edu' });
  if (!adminExists) {
    await User.create({
      name: 'System Admin',
      email: 'admin@toms.edu',
      password: 'admin123',
      role: 'admin',
    });
  }

  const managerExists = await User.findOne({ email: 'manager@toms.edu' });
  if (!managerExists) {
    await User.create({
      name: 'Campus Manager',
      email: 'manager@toms.edu',
      password: 'manager123',
      role: 'campus_manager',
    });
  }

  await User.deleteOne({ email: 'trainer@toms.edu' });
  await User.create({
    name: trainers[0].name,
    email: 'trainer@toms.edu',
    password: 'trainer123',
    role: 'trainer',
    trainer: trainers[0]._id,
  });

  console.log('\n--- Workbook seed completed ---');
  console.log(`Trainers: ${trainers.length}`);
  console.log(`Schedules: ${schedules.length}`);
  console.log('Semester: III');
  console.log('\nLogin: admin@toms.edu / admin123');
  console.log('       trainer@toms.edu / trainer123 (linked to first trainer)\n');

  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
