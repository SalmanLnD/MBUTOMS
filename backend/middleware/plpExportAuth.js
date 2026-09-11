import { asyncHandler } from './asyncHandler.js';
import { validatePlpExportKey } from '../services/plpSheetsService.js';
import { exportGuard } from './exportGuard.js';

export const requirePlpExportKey = asyncHandler(async (req, res, next) => {
  const key = req.query.key || req.headers['x-sheets-key'];
  if (!(await validatePlpExportKey(key))) {
    return res.status(401).json({ message: 'Invalid or missing PLP export key' });
  }
  return exportGuard(req, res, next);
});
