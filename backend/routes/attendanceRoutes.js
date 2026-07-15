import express from 'express';
import {
  getAttendance,
  markAttendance,
  updateAttendance,
  getAttendanceSummary,
} from '../controllers/attendanceController.js';
import {
  getTrainerAttendanceGrid,
  upsertTrainerDailyAttendance,
  getTrainerPunchInLogs,
  deleteTrainerPunchInLog,
} from '../controllers/trainerAttendanceController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { attendanceValidation } from '../utils/validators.js';
import {
  exportTrainerAttendanceForSheets,
  getTrainerAttendanceAppsScriptSetup,
  getTrainerAttendanceSheetStatus,
  linkTrainerAttendanceSheet,
  unlinkTrainerAttendanceSheet,
} from '../controllers/attendanceSheetsController.js';
import { requireAttendanceExportKey } from '../middleware/attendanceExportAuth.js';

const router = express.Router();

router.get(
  '/export',
  requireAttendanceExportKey,
  asyncHandler(exportTrainerAttendanceForSheets)
);

router.use(protect);

router.get('/summary', asyncHandler(getAttendanceSummary));
router.get('/trainer-grid', asyncHandler(getTrainerAttendanceGrid));
router.get('/trainer-punch-logs', asyncHandler(getTrainerPunchInLogs));
router.get(
  '/sheets/status',
  authorize('admin', 'campus_manager'),
  asyncHandler(getTrainerAttendanceSheetStatus)
);
router.get(
  '/sheets/apps-script/setup',
  authorize('admin', 'campus_manager'),
  asyncHandler(getTrainerAttendanceAppsScriptSetup)
);
router.post(
  '/sheets/link',
  authorize('admin', 'campus_manager'),
  asyncHandler(linkTrainerAttendanceSheet)
);
router.delete(
  '/sheets/link',
  authorize('admin', 'campus_manager'),
  asyncHandler(unlinkTrainerAttendanceSheet)
);
router.delete(
  '/trainer-punch-logs/:id',
  authorize('admin', 'campus_manager'),
  asyncHandler(deleteTrainerPunchInLog)
);
router.put(
  '/trainer-daily',
  authorize('admin', 'campus_manager', 'trainer'),
  asyncHandler(upsertTrainerDailyAttendance)
);
router.route('/').get(asyncHandler(getAttendance)).post(authorize('admin', 'campus_manager', 'trainer'), attendanceValidation, validate, asyncHandler(markAttendance));
router.put('/:id', authorize('admin', 'campus_manager', 'trainer'), asyncHandler(updateAttendance));

export default router;
