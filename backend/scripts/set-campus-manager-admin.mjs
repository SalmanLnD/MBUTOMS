import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

const CAMPUS_MANAGER_EMAIL = 'mbu.campusmanager@faceprep.in';
const CAMPUS_MANAGER_PASSWORD = 'Mbu#2026';
const LEGACY_ADMIN_EMAIL = 'admin@toms.edu';

await mongoose.connect(process.env.MONGODB_URI);

const removed = await User.deleteOne({ email: LEGACY_ADMIN_EMAIL });
if (removed.deletedCount) {
  console.log(`Removed legacy admin: ${LEGACY_ADMIN_EMAIL}`);
} else {
  console.log(`Legacy admin not found: ${LEGACY_ADMIN_EMAIL}`);
}

let user = await User.findOne({ email: CAMPUS_MANAGER_EMAIL });
if (user) {
  user.name = 'MBU Campus Manager';
  user.role = 'admin';
  user.password = CAMPUS_MANAGER_PASSWORD;
  user.isActive = true;
  await user.save();
  console.log(`Updated existing user to admin: ${CAMPUS_MANAGER_EMAIL}`);
} else {
  user = await User.create({
    name: 'MBU Campus Manager',
    email: CAMPUS_MANAGER_EMAIL,
    password: CAMPUS_MANAGER_PASSWORD,
    role: 'admin',
  });
  console.log(`Created admin user: ${CAMPUS_MANAGER_EMAIL}`);
}

console.log('Done.');
await mongoose.disconnect();
