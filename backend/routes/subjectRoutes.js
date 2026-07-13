import express from 'express';
import {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  updateSubjectResources,
  deleteSubject,
  getSemesters,
  getDepartments,
  getSchools,
} from '../controllers/subjectController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { subjectValidation, subjectResourceValidation } from '../utils/validators.js';

const router = express.Router();

router.use(protect);

router.get('/schools/list', asyncHandler(getSchools));
router.get('/semesters/list', asyncHandler(getSemesters));
router.get('/departments/list', asyncHandler(getDepartments));

router
  .route('/')
  .get(asyncHandler(getSubjects))
  .post(authorize('admin', 'campus_manager'), subjectValidation, validate, asyncHandler(createSubject));

router.patch(
  '/:id/resources',
  authorize('admin', 'campus_manager', 'manager'),
  subjectResourceValidation,
  validate,
  asyncHandler(updateSubjectResources)
);

router
  .route('/:id')
  .get(asyncHandler(getSubjectById))
  .put(authorize('admin', 'campus_manager'), subjectValidation, validate, asyncHandler(updateSubject))
  .delete(authorize('admin'), asyncHandler(deleteSubject));

export default router;
