import { asyncHandler } from './asyncHandler.js';
import { exportGuard } from './exportGuard.js';
import { validateExportKey } from '../services/appsScriptSheetsService.js';

export const requireSheetsExportKey = asyncHandler(async (req, res, next) => {
  const key = req.query.key || req.headers['x-sheets-key'];
  const valid = await validateExportKey(key);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid or missing export key' });
  }
  return exportGuard(req, res, next);
});
