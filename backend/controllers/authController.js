import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { INITIAL_TRAINER_PASSWORD } from '../constants/trainerAuth.js';

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const userResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  trainer: user.trainer,
  mustResetPassword: Boolean(user.mustResetPassword),
  requiresPasswordReset: Boolean(user.mustResetPassword),
  token: generateToken(user._id),
});

export const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email?.trim()?.toLowerCase() })
    .populate('trainer', 'name employeeId');
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: 'Account is deactivated' });
  }

  const usedInitialPassword = await user.matchPassword(INITIAL_TRAINER_PASSWORD);
  if (user.role === 'trainer' && usedInitialPassword && !user.mustResetPassword) {
    user.mustResetPassword = true;
    await user.save();
  }

  res.json(userResponse(user));
};

export const getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-password')
    .populate('trainer', 'name employeeId department');
  res.json({
    ...user.toObject(),
    requiresPasswordReset: Boolean(user.mustResetPassword),
  });
};

export const resetPassword = async (req, res) => {
  const { newPassword, confirmPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }
  if (newPassword === INITIAL_TRAINER_PASSWORD) {
    return res.status(400).json({ message: 'Please choose a different password than the initial OTP' });
  }

  const user = await User.findById(req.user._id).populate('trainer', 'name employeeId');
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  user.password = newPassword;
  user.mustResetPassword = false;
  await user.save();

  res.json({
    message: 'Password updated successfully',
    ...userResponse(user),
  });
};

export const logout = async (req, res) => {
  res.json({ message: 'Logged out successfully' });
};
