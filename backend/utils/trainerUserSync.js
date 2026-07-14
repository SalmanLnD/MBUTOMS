import User from '../models/User.js';
import { INITIAL_TRAINER_PASSWORD } from '../constants/trainerAuth.js';
import { ROLES } from './roles.js';

/** Roles that log in through a linked trainer profile and can use the initial OTP. */
const TRAINER_LINKED_LOGIN_ROLES = [ROLES.TRAINER, ROLES.SUBJECT_COORDINATOR];

export const syncTrainerUser = async (trainer, { resetPassword = false } = {}) => {
  const email = trainer.email?.trim()?.toLowerCase();
  if (!email) return null;

  let user = await User.findOne({ trainer: trainer._id });
  if (!user) {
    user = await User.findOne({ email });
  }

  if (user && !TRAINER_LINKED_LOGIN_ROLES.includes(user.role)) {
    return null;
  }

  if (!user) {
    user = new User({
      name: trainer.name,
      email,
      password: INITIAL_TRAINER_PASSWORD,
      role: ROLES.TRAINER,
      trainer: trainer._id,
      mustResetPassword: true,
    });
    await user.save();
    return user;
  }

  user.name = trainer.name;
  user.email = email;
  user.trainer = trainer._id;

  if (resetPassword) {
    user.password = INITIAL_TRAINER_PASSWORD;
    user.mustResetPassword = true;
    user.sessionVersion = (user.sessionVersion || 1) + 1;
  }

  await user.save();
  return user;
};

export const removeTrainerUser = async (trainerId) => {
  await User.deleteOne({ trainer: trainerId, role: ROLES.TRAINER });
};
