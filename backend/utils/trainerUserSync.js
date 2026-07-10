import User from '../models/User.js';
import { INITIAL_TRAINER_PASSWORD } from '../constants/trainerAuth.js';

export const syncTrainerUser = async (trainer, { resetPassword = false } = {}) => {
  const email = trainer.email?.trim()?.toLowerCase();
  if (!email) return null;

  let user = await User.findOne({ trainer: trainer._id });
  if (!user) {
    user = await User.findOne({ email });
  }

  if (user && user.role !== 'trainer') {
    return null;
  }

  if (!user) {
    user = new User({
      name: trainer.name,
      email,
      password: INITIAL_TRAINER_PASSWORD,
      role: 'trainer',
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
  }

  await user.save();
  return user;
};

export const removeTrainerUser = async (trainerId) => {
  await User.deleteOne({ trainer: trainerId, role: 'trainer' });
};
