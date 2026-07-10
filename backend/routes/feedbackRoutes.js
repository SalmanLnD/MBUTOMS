import express from 'express';
import {
  getFeedbackSummary,
  getFeedbackResponses,
  getFeedbackForms,
  getCurrentMonthForm,
  createCurrentMonthForm,
  updateFeedbackForm,
  publishFeedbackForm,
  getPublicFeedbackForm,
  submitPublicFeedback,
} from '../controllers/feedbackController.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

router.get('/public/:slug', asyncHandler(getPublicFeedbackForm));
router.post('/public/:slug/submit', asyncHandler(submitPublicFeedback));

router.use(protect);
router.use(authorize('admin', 'campus_manager'));

router.get('/summary', asyncHandler(getFeedbackSummary));
router.get('/responses', asyncHandler(getFeedbackResponses));
router.get('/forms', asyncHandler(getFeedbackForms));
router.get('/forms/current', asyncHandler(getCurrentMonthForm));
router.post('/forms/current', asyncHandler(createCurrentMonthForm));
router.put('/forms/:id', asyncHandler(updateFeedbackForm));
router.post('/forms/:id/publish', asyncHandler(publishFeedbackForm));

export default router;
