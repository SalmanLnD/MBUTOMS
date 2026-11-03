import { randomInt } from 'node:crypto';

export const createTrainerOtp = (now = new Date()) => ({
  otp: String(randomInt(0, 1000000)).padStart(6, '0'),
  expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
});

export const isUsableTrainerOtp = (user, now = new Date()) => Boolean(
  user.mustResetPassword && user.otpExpiresAt && new Date(user.otpExpiresAt) > now
  && (user.otpAttempts || 0) < 5
);
