import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { isAuthorizedRole } from '../utils/roles.js';
import {
  APP_VERSION,
  isCompatibleAppVersion,
  APP_VERSION_UPDATED_CODE,
  APP_VERSION_UPDATED_MESSAGE,
  SESSION_EXPIRED_CODE,
  SESSION_EXPIRED_MESSAGE,
} from '../utils/sessionVersion.js';
import { attachManagerEditNotifier } from '../utils/managerEditNotifications.js';
import { DEMO_ROLE, isDemoRequestAllowed, rejectDemoWrite, maskDemoCredentials } from '../utils/demoAccess.js';

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
    if (!isCompatibleAppVersion(decoded.av)) {
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

    if (decoded.demoOwner) {
      const owner = req.impersonator;
      if (!owner || String(owner._id) !== decoded.demoOwner || owner.role !== DEMO_ROLE
        || !owner.isActive || (owner.sessionVersion ?? 1) !== decoded.demoSv) {
        return res.status(401).json({ message: SESSION_EXPIRED_MESSAGE, code: SESSION_EXPIRED_CODE });
      }
    }
    req.isDemo = req.user.role === DEMO_ROLE || Boolean(decoded.demoOwner);
    if (req.isDemo) {
      if (!isDemoRequestAllowed(req)) return rejectDemoWrite(res);
      req.demoAccountId = decoded.demoOwner || String(req.user._id);
      const json = res.json.bind(res);
      res.json = (data) => json(maskDemoCredentials(JSON.parse(JSON.stringify(data))));
      if (req.user.role === DEMO_ROLE) {
        req.user = { ...(req.user.toObject?.() || req.user), role: 'admin', isDemo: true };
      }
    } else attachManagerEditNotifier(req, res);
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
