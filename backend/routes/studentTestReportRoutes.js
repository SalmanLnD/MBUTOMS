import express from 'express';
import {
  getTestReportFilterOptions,
  getTestReportSubjects,
  getTestReportSummary,
  getTestReportGrid,
  bulkUpsertTestReports,
  downloadTestReportExcel,
  exportTestReportsForSheets,
} from '../controllers/studentTestReportController.js';
import {
  getStudentTestReportSheetStatus,
  getStudentTestReportAppsScriptSetup,
  linkStudentTestReportSheet,
  unlinkStudentTestReportSheet,
} from '../controllers/studentTestReportSheetsController.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireTestReportExportKey } from '../middleware/studentTestReportExportAuth.js';

const router = express.Router();

const EDIT_ROLES = ['admin', 'manager', 'campus_manager', 'subject_coordinator', 'trainer', 'evaluator'];
const SHEET_ROLES = ['admin', 'campus_manager'];

router.get(
  '/export',
  requireTestReportExportKey,
  asyncHandler(exportTestReportsForSheets)
);

router.use(protect);

router.get('/filter-options', asyncHandler(getTestReportFilterOptions));
router.get('/subjects', asyncHandler(getTestReportSubjects));
router.get('/summary', asyncHandler(getTestReportSummary));
router.get('/grid', asyncHandler(getTestReportGrid));
router.get('/export/excel', asyncHandler(downloadTestReportExcel));
router.put('/bulk', authorize(...EDIT_ROLES), asyncHandler(bulkUpsertTestReports));

router.get(
  '/sheets/status',
  authorize(...SHEET_ROLES),
  asyncHandler(getStudentTestReportSheetStatus)
);
router.get(
  '/sheets/apps-script/setup',
  authorize(...SHEET_ROLES),
  asyncHandler(getStudentTestReportAppsScriptSetup)
);
router.post(
  '/sheets/link',
  authorize(...SHEET_ROLES),
  asyncHandler(linkStudentTestReportSheet)
);
router.delete(
  '/sheets/link',
  authorize(...SHEET_ROLES),
  asyncHandler(unlinkStudentTestReportSheet)
);

export default router;
