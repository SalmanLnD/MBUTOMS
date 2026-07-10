import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { isAuthorizedRole } from '../utils/roles.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (decoded.impersonatedBy) {
      req.impersonator = await User.findById(decoded.impersonatedBy).select('-password');
      if (!req.impersonator) {
        return res.status(401).json({ message: 'Impersonation session is invalid' });
      }
    }

    next();
  } catch {
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

export const authorize = (...roles) => (req, res, next) => {
  if (req.impersonator) {
    return res.status(403).json({
      message: 'Exit trainer view before using admin features.',
    });
  }

  if (!isAuthorizedRole(req.user?.role, roles)) {
    return res.status(403).json({
      message: `Role '${req.user?.role}' is not authorized for this action`,
    });
  }
  next();
};
