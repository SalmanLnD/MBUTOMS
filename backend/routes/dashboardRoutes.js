import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { getActionCounts } from '../controllers/actionCountsController.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

router.get('/stats', protect, asyncHandler(getDashboardStats));
router.get('/action-counts', protect, asyncHandler(getActionCounts));

export default router;
