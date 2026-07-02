import express from 'express';
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
} from '../controllers/studentController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { studentCreateValidation, studentValidation } from '../utils/validators.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(asyncHandler(getStudents))
  .post(authorize('admin', 'campus_manager'), studentCreateValidation, validate, asyncHandler(createStudent));

router
  .route('/:id')
  .get(asyncHandler(getStudentById))
  .put(authorize('admin', 'campus_manager'), studentValidation, validate, asyncHandler(updateStudent))
  .delete(authorize('admin', 'campus_manager'), asyncHandler(deleteStudent));

export default router;
