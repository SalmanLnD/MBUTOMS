import express from 'express';
import {
  login,
  getMe,
  logout,
  resetPassword,
  getImpersonationTargets,
  impersonateUser,
  stopImpersonation,
} from '../controllers/authController.js';
import { protect, allowPasswordResetSession } from '../middleware/auth.js';
import { loginRateLimit } from '../middleware/loginRateLimit.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { loginValidation } from '../utils/validators.js';

const router = express.Router();

router.post('/login', loginRateLimit, loginValidation, validate, asyncHandler(login));
router.post('/reset-password', allowPasswordResetSession, protect, asyncHandler(resetPassword));
router.get('/me', allowPasswordResetSession, protect, asyncHandler(getMe));
router.post('/logout', allowPasswordResetSession, protect, asyncHandler(logout));
router.get('/impersonation-targets', protect, asyncHandler(getImpersonationTargets));
router.post('/impersonate', protect, asyncHandler(impersonateUser));
router.post('/stop-impersonation', allowPasswordResetSession, protect, asyncHandler(stopImpersonation));

export default router;
