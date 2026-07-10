import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Trainer from '../models/Trainer.js';
import { ROSTER_HIDDEN_STAFF_ROLES } from '../utils/roles.js';

dotenv.config();

const MANAGER_EMAIL = 'semikala.venkateshwarareddy@faceprep.in';
const MANAGER_NAME = 'Semikala Venkateshwarareddy';
const ADMIN_EMAIL = 'mbu.campusmanager@faceprep.in';
const DEFAULT_PASSWORD = 'Mbu#2026';

const hideTrainerFromRoster = async (trainerId, label) => {
  if (!trainerId) return;
  await Trainer.updateOne({ _id: trainerId }, { $set: { showInRoster: false } });
  console.log(`Hidden from roster: ${label}`);
};

await mongoose.connect(process.env.MONGODB_URI);

let managerUser = await User.findOne({ email: MANAGER_EMAIL });
if (!managerUser) {
  const trainerMatch = await Trainer.findOne({
    $or: [
      { email: MANAGER_EMAIL },
      { name: /semikala/i },
      { name: /venkateshwarareddy/i },
    ],
  });

  managerUser = await User.create({
    name: trainerMatch?.name || MANAGER_NAME,
    email: MANAGER_EMAIL,
    password: DEFAULT_PASSWORD,
    role: 'manager',
    trainer: trainerMatch?._id || undefined,
    isActive: true,
    mustResetPassword: false,
  });
  console.log(`Created manager user: ${MANAGER_EMAIL}`);
} else {
  managerUser.role = 'manager';
  managerUser.isActive = true;
  managerUser.name = managerUser.name || MANAGER_NAME;
  await managerUser.save();
  console.log(`Updated manager user: ${MANAGER_EMAIL}`);
}

const staffUsers = await User.find({
  role: { $in: ROSTER_HIDDEN_STAFF_ROLES },
}).select('name email role trainer');

for (const staffUser of staffUsers) {
  if (staffUser.trainer) {
    await hideTrainerFromRoster(staffUser.trainer, `${staffUser.name} (${staffUser.role})`);
  }
}

const salmanTrainer = await Trainer.findOne({
  $or: [
    { name: /salman/i },
    { email: /salman/i },
    { employeeId: /salman/i },
  ],
});
if (salmanTrainer) {
  await hideTrainerFromRoster(salmanTrainer._id, salmanTrainer.name);
}

const adminUser = await User.findOne({ email: ADMIN_EMAIL });
if (adminUser && !adminUser.trainer) {
  const adminTrainer = await Trainer.findOne({
    $or: [
      { email: ADMIN_EMAIL },
      { name: /campus manager/i },
      { name: /mbu campus/i },
    ],
  });
  if (adminTrainer) {
    await hideTrainerFromRoster(adminTrainer._id, adminTrainer.name);
  }
}

console.log('\nStaff role setup complete.');
await mongoose.disconnect();
