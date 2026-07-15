import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { isAuthorizedRole } from '../utils/roles.js';
import {
  APP_VERSION,
  APP_VERSION_UPDATED_CODE,
  APP_VERSION_UPDATED_MESSAGE,
  SESSION_EXPIRED_CODE,
  SESSION_EXPIRED_MESSAGE,
} from '../utils/sessionVersion.js';
import { attachManagerEditNotifier } from '../utils/managerEditNotifications.js';

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
    if (decoded.av !== APP_VERSION) {
      return res.status(401).json({
        message: APP_VERSION_UPDATED_MESSAGE,
        code: APP_VERSION_UPDATED_CODE,
        version: APP_VERSION,
      });
    }

    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!req.user.isActive) {
      return res.status(401).json({
        message: SESSION_EXPIRED_MESSAGE,
        code: SESSION_EXPIRED_CODE,
      });
    }

    const tokenSessionVersion = decoded.sv ?? 0;
    const currentSessionVersion = req.user.sessionVersion ?? 1;
    if (tokenSessionVersion !== currentSessionVersion) {
      return res.status(401).json({
        message: SESSION_EXPIRED_MESSAGE,
        code: SESSION_EXPIRED_CODE,
      });
    }

    if (decoded.impersonatedBy) {
      req.impersonator = await User.findById(decoded.impersonatedBy).select('-password');
      if (!req.impersonator) {
        return res.status(401).json({ message: 'Impersonation session is invalid' });
      }
    }

    attachManagerEditNotifier(req, res);
    next();
  } catch {
    return res.status(401).json({
      message: SESSION_EXPIRED_MESSAGE,
      code: SESSION_EXPIRED_CODE,
    });
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

/** Same as authorize, but without campus_manager ↔ subject_coordinator role aliasing. */
export const authorizeExact = (...roles) => (req, res, next) => {
  if (req.impersonator) {
    return res.status(403).json({
      message: 'Exit trainer view before using admin features.',
    });
  }

  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({
      message: `Role '${req.user?.role}' is not authorized for this action`,
    });
  }
  next();
};
