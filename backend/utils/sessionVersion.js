import { createRequire } from 'node:module';
import User from '../models/User.js';

const require = createRequire(import.meta.url);
const { version: packageVersion } = require('../package.json');

export const SESSION_EXPIRED_CODE = 'SESSION_EXPIRED';
export const APP_VERSION_UPDATED_CODE = 'APP_VERSION_UPDATED';
export const APP_VERSION = packageVersion;

export const SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Please sign in again to continue with your updated access.';

export const APP_VERSION_UPDATED_MESSAGE =
  `TOMS was updated to version ${APP_VERSION}. Your previous session has expired. Sign in again to load the updated interface.`;

export const bumpUserSessionVersion = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { sessionVersion: 1 } },
    { new: true }
  ).select('sessionVersion');

  return user?.sessionVersion ?? 1;
};
