import express from 'express';
import {
  getTrainers,
  getTrainerById,
  createTrainer,
  updateTrainer,
  deleteTrainer,
  getDepartments,
  resetTrainerPassword,
} from '../controllers/trainerController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { trainerValidation } from '../utils/validators.js';

const router = express.Router();

router.use(protect);

router.get('/departments/list', asyncHandler(getDepartments));
router
  .route('/')
  .get(asyncHandler(getTrainers))
  .post(authorize('admin', 'campus_manager'), trainerValidation, validate, asyncHandler(createTrainer));

router
  .route('/:id')
  .get(asyncHandler(getTrainerById))
  .put(authorize('admin', 'campus_manager'), trainerValidation, validate, asyncHandler(updateTrainer))
  .delete(authorize('admin'), asyncHandler(deleteTrainer));

router.post(
  '/:id/reset-password',
  authorize('admin', 'manager', 'campus_manager'),
  asyncHandler(resetTrainerPassword)
);

export default router;
