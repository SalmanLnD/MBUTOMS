import express from 'express';
import {
  getTimetableSheetStatus,
  getTimetableAppsScriptSetup,
  linkTimetableSheet,
  exportTimetableForSheets,
  unlinkTimetableSheet,
} from '../controllers/sheetsController.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireSheetsExportKey } from '../middleware/sheetsExportAuth.js';

const router = express.Router();

router.get('/timetable/export', requireSheetsExportKey, asyncHandler(exportTimetableForSheets));

router.use(protect);

router.get('/timetable/status', asyncHandler(getTimetableSheetStatus));
router.get('/timetable/apps-script/setup', authorize('admin', 'campus_manager'), asyncHandler(getTimetableAppsScriptSetup));
router.post('/timetable/link', authorize('admin', 'campus_manager'), asyncHandler(linkTimetableSheet));
router.delete('/timetable/link', authorize('admin', 'campus_manager'), asyncHandler(unlinkTimetableSheet));

export default router;
