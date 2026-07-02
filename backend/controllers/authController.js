import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

export const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).populate('trainer', 'name employeeId');
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: 'Account is deactivated' });
  }

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    trainer: user.trainer,
    token: generateToken(user._id),
  });
};

export const getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-password')
    .populate('trainer', 'name employeeId department');
  res.json(user);
};

export const logout = async (req, res) => {
  res.json({ message: 'Logged out successfully' });
};
