import { validatePlpExportKey } from '../services/plpSheetsService.js';

export const requirePlpExportKey = async (req, res, next) => {
  const key = req.query.key || req.headers['x-sheets-key'];
  if (!(await validatePlpExportKey(key))) {
    return res.status(401).json({ message: 'Invalid or missing PLP export key' });
  }
  next();
};
