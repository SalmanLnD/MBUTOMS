import express from 'express';
import {
  getAttendance,
  markAttendance,
  updateAttendance,
  getAttendanceSummary,
} from '../controllers/attendanceController.js';
import {
  getTrainerAttendanceGrid,
  upsertTrainerDailyAttendance,
} from '../controllers/trainerAttendanceController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { attendanceValidation } from '../utils/validators.js';

const router = express.Router();

router.use(protect);

router.get('/summary', asyncHandler(getAttendanceSummary));
router.get('/trainer-grid', asyncHandler(getTrainerAttendanceGrid));
router.put(
  '/trainer-daily',
  authorize('admin', 'campus_manager', 'trainer'),
  asyncHandler(upsertTrainerDailyAttendance)
);
router.route('/').get(asyncHandler(getAttendance)).post(authorize('admin', 'campus_manager', 'trainer'), attendanceValidation, validate, asyncHandler(markAttendance));
router.put('/:id', authorize('admin', 'campus_manager', 'trainer'), asyncHandler(updateAttendance));

export default router;
