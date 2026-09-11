import { asyncHandler } from './asyncHandler.js';
import { validateFeedbackExportKey } from '../services/feedbackSheetsService.js';
import { exportGuard } from './exportGuard.js';

export const requireFeedbackExportKey = asyncHandler(async (req, res, next) => {
  const key = req.query.key || req.headers['x-sheets-key'];
  const valid = await validateFeedbackExportKey(key);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid or missing export key' });
  }
  return exportGuard(req, res, next);
});
