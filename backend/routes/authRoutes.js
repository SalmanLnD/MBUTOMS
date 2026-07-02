import express from 'express';
import { login, getMe, logout } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { loginValidation } from '../utils/validators.js';

const router = express.Router();

router.post('/login', loginValidation, validate, asyncHandler(login));
router.get('/me', protect, asyncHandler(getMe));
router.post('/logout', protect, asyncHandler(logout));

export default router;
