import express from 'express';
import {
  getTestReportFilterOptions,
  getTestReportGrid,
  bulkUpsertTestReports,
} from '../controllers/studentTestReportController.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

const EDIT_ROLES = ['admin', 'manager', 'campus_manager', 'subject_coordinator', 'trainer', 'evaluator'];

router.use(protect);

router.get('/filter-options', asyncHandler(getTestReportFilterOptions));
router.get('/grid', asyncHandler(getTestReportGrid));
router.put('/bulk', authorize(...EDIT_ROLES), asyncHandler(bulkUpsertTestReports));

export default router;
