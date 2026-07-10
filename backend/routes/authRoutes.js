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
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { loginValidation } from '../utils/validators.js';

const router = express.Router();

router.post('/login', loginValidation, validate, asyncHandler(login));
router.post('/reset-password', protect, asyncHandler(resetPassword));
router.get('/me', protect, asyncHandler(getMe));
router.post('/logout', protect, asyncHandler(logout));
router.get('/impersonation-targets', protect, asyncHandler(getImpersonationTargets));
router.post('/impersonate', protect, asyncHandler(impersonateUser));
router.post('/stop-impersonation', protect, asyncHandler(stopImpersonation));

export default router;
