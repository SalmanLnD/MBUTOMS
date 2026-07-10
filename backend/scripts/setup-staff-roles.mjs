import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Trainer from '../models/Trainer.js';
import { ROSTER_HIDDEN_STAFF_ROLES } from '../utils/roles.js';

dotenv.config();

const ADMIN_EMAIL = 'mbu.campusmanager@faceprep.in';
const DEFAULT_PASSWORD = 'Mbu#2026';

const MANAGERS = [
  {
    email: 'semikala.venkateshwarareddy@faceprep.in',
    name: 'Semikala Venkateshwarareddy',
    trainerSearch: [/semikala/i, /venkateshwarareddy/i],
  },
  {
    email: 'tamilarasan@faceprep.in',
    name: 'Tamilarasan',
    trainerSearch: [/tamilarasan/i],
  },
];

const hideTrainerFromRoster = async (trainerId, label) => {
  if (!trainerId) return;
  await Trainer.updateOne({ _id: trainerId }, { $set: { showInRoster: false } });
  console.log(`Hidden from roster: ${label}`);
};

const upsertManager = async ({ email, name, trainerSearch = [] }) => {
  const normalizedEmail = email.trim().toLowerCase();
  let managerUser = await User.findOne({ email: normalizedEmail });

  const trainerMatch = await Trainer.findOne({
    $or: [
      { email: normalizedEmail },
      ...trainerSearch.map((pattern) => ({ name: pattern })),
    ],
  });

  if (!managerUser) {
    managerUser = await User.create({
      name: trainerMatch?.name || name,
      email: normalizedEmail,
      password: DEFAULT_PASSWORD,
      role: 'manager',
      trainer: trainerMatch?._id || undefined,
      isActive: true,
      mustResetPassword: false,
    });
    console.log(`Created manager user: ${normalizedEmail}`);
    return managerUser;
  }

  managerUser.role = 'manager';
  managerUser.isActive = true;
  managerUser.name = managerUser.name || trainerMatch?.name || name;
  managerUser.password = DEFAULT_PASSWORD;
  managerUser.mustResetPassword = false;
  if (trainerMatch?._id && !managerUser.trainer) {
    managerUser.trainer = trainerMatch._id;
  }
  await managerUser.save();
  console.log(`Updated manager user: ${normalizedEmail}`);
  return managerUser;
};

await mongoose.connect(process.env.MONGODB_URI);

for (const manager of MANAGERS) {
  await upsertManager(manager);
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
