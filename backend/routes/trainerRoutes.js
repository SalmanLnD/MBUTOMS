import express from 'express';
import { body } from 'express-validator';
import {
  getTrainers,
  getTrainerById,
  createTrainer,
  updateTrainer,
  deleteTrainer,
  getDepartments,
  resetTrainerPassword,
} from '../controllers/trainerController.js';
import {
  resignTrainer,
  permanentReplaceTrainer,
  getReplacementCandidates,
} from '../controllers/trainerTransferController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { trainerValidation } from '../utils/validators.js';

const resignValidation = [
  body('successorTrainerId').notEmpty().withMessage('Permanent replacement trainer is required'),
  body('resignationDate').isISO8601().withMessage('Resignation date is required'),
];

const permanentReplacementValidation = [
  body('successorTrainerId').notEmpty().withMessage('Replacement trainer is required'),
  body('effectiveDate').isISO8601().withMessage('Effective from date is required'),
];

const router = express.Router();

router.use(protect);

router.get('/departments/list', asyncHandler(getDepartments));
router.get(
  '/replacement-candidates',
  authorize('admin', 'campus_manager'),
  asyncHandler(getReplacementCandidates)
);
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

router.post(
  '/:id/resign',
  authorize('admin', 'campus_manager'),
  resignValidation,
  validate,
  asyncHandler(resignTrainer)
);

router.post(
  '/:id/permanent-replacement',
  authorize('admin', 'campus_manager'),
  permanentReplacementValidation,
  validate,
  asyncHandler(permanentReplaceTrainer)
);

export default router;
