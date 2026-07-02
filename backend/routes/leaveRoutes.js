import express from 'express';
import {
  getLeaves,
  getLeaveById,
  createLeave,
  updateLeave,
  deleteLeave,
  previewAffectedSchedules,
} from '../controllers/leaveController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { leaveValidation } from '../utils/validators.js';

const router = express.Router();

router.use(protect);

router.get('/preview/affected', asyncHandler(previewAffectedSchedules));
router.route('/').get(asyncHandler(getLeaves)).post(leaveValidation, validate, asyncHandler(createLeave));
router.route('/:id').get(asyncHandler(getLeaveById)).delete(asyncHandler(deleteLeave));
router.put('/:id', authorize('admin', 'campus_manager'), asyncHandler(updateLeave));

export default router;
