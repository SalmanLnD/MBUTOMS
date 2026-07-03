import { validateExportKey } from '../services/appsScriptSheetsService.js';

export const requireSheetsExportKey = async (req, res, next) => {
  const key = req.query.key || req.headers['x-sheets-key'];
  const valid = await validateExportKey(key);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid or missing export key' });
  }
  next();
};
