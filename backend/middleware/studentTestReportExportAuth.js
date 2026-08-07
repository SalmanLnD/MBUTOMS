import { validateTestReportExportKey } from '../services/studentTestReportSheetsService.js';

export const requireTestReportExportKey = async (req, res, next) => {
  const key = req.query.key || req.headers['x-sheets-key'];
  if (!(await validateTestReportExportKey(key))) {
    return res.status(401).json({ message: 'Invalid or missing test report export key' });
  }
  next();
};
