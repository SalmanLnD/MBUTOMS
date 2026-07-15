import { validateAttendanceExportKey } from '../services/attendanceSheetsService.js';

export const requireAttendanceExportKey = async (req, res, next) => {
  const key = req.query.key || req.headers['x-sheets-key'];
  if (!(await validateAttendanceExportKey(key))) {
    return res.status(401).json({ message: 'Invalid or missing attendance export key' });
  }
  next();
};
