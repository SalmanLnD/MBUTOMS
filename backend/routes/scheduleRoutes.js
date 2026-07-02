import express from 'express';
import {
  getSchedules,
  getScheduleById,
  getTrainerSchedule,
  getTrainerScheduleByCode,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getBatches,
} from '../controllers/scheduleController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { scheduleValidation } from '../utils/validators.js';

const router = express.Router();

router.use(protect);

router.get('/batches/list', asyncHandler(getBatches));
router.get('/trainer/:id', asyncHandler(getTrainerSchedule));
router.get('/trainer-code/:code', asyncHandler(getTrainerScheduleByCode));

router
  .route('/')
  .get(asyncHandler(getSchedules))
  .post(authorize('admin', 'campus_manager'), scheduleValidation, validate, asyncHandler(createSchedule));

router
  .route('/:id')
  .get(asyncHandler(getScheduleById))
  .put(authorize('admin', 'campus_manager'), scheduleValidation, validate, asyncHandler(updateSchedule))
  .delete(authorize('admin', 'campus_manager'), asyncHandler(deleteSchedule));

export default router;
