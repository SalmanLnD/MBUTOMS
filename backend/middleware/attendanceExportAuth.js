import { asyncHandler } from './asyncHandler.js';
import { validateAttendanceExportKey } from '../services/attendanceSheetsService.js';
import { exportGuard } from './exportGuard.js';

export const requireAttendanceExportKey = asyncHandler(async (req, res, next) => {
  const key = req.query.key || req.headers['x-sheets-key'];
  if (!(await validateAttendanceExportKey(key))) {
    return res.status(401).json({ message: 'Invalid or missing attendance export key' });
  }
  return exportGuard(req, res, next);
});
