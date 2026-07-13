import User from '../models/User.js';

export const SESSION_EXPIRED_CODE = 'SESSION_EXPIRED';

export const SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Please sign in again to continue with your updated access.';

export const bumpUserSessionVersion = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { sessionVersion: 1 } },
    { new: true }
  ).select('sessionVersion');

  return user?.sessionVersion ?? 1;
};
