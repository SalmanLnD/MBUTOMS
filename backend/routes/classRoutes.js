import express from 'express';
import {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
} from '../controllers/classController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { classValidation } from '../utils/validators.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(asyncHandler(getClasses))
  .post(authorize('admin', 'campus_manager'), classValidation, validate, asyncHandler(createClass));

router
  .route('/:id')
  .get(asyncHandler(getClassById))
  .put(authorize('admin', 'campus_manager'), classValidation, validate, asyncHandler(updateClass))
  .delete(authorize('admin', 'campus_manager'), asyncHandler(deleteClass));

export default router;
