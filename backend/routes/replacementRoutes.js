import express from 'express';
import {
  getReplacementSuggestions,
  getPendingReplacements,
  assignReplacement,
} from '../controllers/replacementController.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'campus_manager'));

router.get('/pending', asyncHandler(getPendingReplacements));
router.get('/suggestions/:scheduleId', asyncHandler(getReplacementSuggestions));
router.post('/assign', asyncHandler(assignReplacement));

export default router;
