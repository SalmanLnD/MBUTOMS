import express from 'express';
import { getClasses } from '../controllers/classController.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

router.use(protect);
router.get('/', asyncHandler(getClasses));

export default router;
