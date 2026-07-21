import express from 'express';
import {
  getSchedules,
  getPublicTimetable,
  getTimetableBoard,
  getLiveTrainerVenues,
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
import {
  createClassCancellation,
  deleteClassCancellation,
  getClassCancellationOptions,
} from '../controllers/classCancellationController.js';

const router = express.Router();

router.get('/public-timetable', asyncHandler(getPublicTimetable));

router.use(protect);

router.get('/timetable-board', asyncHandler(getTimetableBoard));
router.get('/live-venues', asyncHandler(getLiveTrainerVenues));
router.get('/batches/list', asyncHandler(getBatches));
router.get(
  '/class-cancellations/options',
  authorize('admin'),
  asyncHandler(getClassCancellationOptions)
);
router.post(
  '/class-cancellations',
  authorize('admin'),
  asyncHandler(createClassCancellation)
);
router.delete(
  '/class-cancellations/:id',
  authorize('admin'),
  asyncHandler(deleteClassCancellation)
);
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
