import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { INITIAL_TRAINER_PASSWORD } from '../constants/trainerAuth.js';
import { canImpersonate, ROLES } from '../utils/roles.js';

const generateToken = (id, impersonatedBy = null) => {
  const payload = impersonatedBy ? { id, impersonatedBy } : { id };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const userResponse = (user, { impersonator = null } = {}) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  trainer: user.trainer,
  mustResetPassword: Boolean(user.mustResetPassword),
  requiresPasswordReset: Boolean(user.mustResetPassword),
  impersonating: Boolean(impersonator),
  impersonator: impersonator
    ? {
        _id: impersonator._id,
        name: impersonator.name,
        email: impersonator.email,
        role: impersonator.role,
      }
    : null,
  token: generateToken(user._id, impersonator?._id),
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
  if (user.role === 'trainer' && usedInitialPassword) {
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
    impersonating: Boolean(req.impersonator),
    impersonator: req.impersonator
      ? {
          _id: req.impersonator._id,
          name: req.impersonator.name,
          email: req.impersonator.email,
          role: req.impersonator.role,
        }
      : null,
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

export const getImpersonationTargets = async (req, res) => {
  if (!canImpersonate(req.user.role)) {
    return res.status(403).json({ message: 'Not authorized to view trainer accounts' });
  }

  const trainers = await User.find({
    role: ROLES.TRAINER,
    isActive: true,
    trainer: { $exists: true, $ne: null },
  })
    .populate('trainer', 'name employeeId showInRoster')
    .select('name email trainer')
    .sort({ name: 1 })
    .lean();

  const targets = trainers
    .filter((entry) => entry.trainer && entry.trainer.showInRoster !== false)
    .map((entry) => ({
      _id: entry._id,
      name: entry.name,
      email: entry.email,
      trainerId: entry.trainer._id,
      employeeId: entry.trainer.employeeId,
    }));

  res.json({ targets });
};

export const impersonateUser = async (req, res) => {
  if (!canImpersonate(req.user.role)) {
    return res.status(403).json({ message: 'Not authorized to impersonate users' });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ message: 'userId is required' });
  }

  const targetUser = await User.findById(userId).populate('trainer', 'name employeeId');
  if (!targetUser || !targetUser.isActive) {
    return res.status(404).json({ message: 'User not found' });
  }
  if (targetUser.role !== ROLES.TRAINER) {
    return res.status(400).json({ message: 'Only trainer accounts can be viewed' });
  }
  if (targetUser._id.toString() === req.user._id.toString()) {
    return res.status(400).json({ message: 'Already signed in as this user' });
  }

  res.json(userResponse(targetUser, { impersonator: req.user }));
};

export const stopImpersonation = async (req, res) => {
  if (!req.impersonator) {
    return res.status(400).json({ message: 'Not currently viewing as another trainer' });
  }

  const adminUser = await User.findById(req.impersonator._id).populate('trainer', 'name employeeId');
  if (!adminUser) {
    return res.status(404).json({ message: 'Original user not found' });
  }

  res.json(userResponse(adminUser));
};
