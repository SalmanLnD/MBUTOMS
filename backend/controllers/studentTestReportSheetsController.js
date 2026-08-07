import {
  getTestReportAppsScriptSetup,
  getTestReportSheetStatus,
  linkTestReportSpreadsheet,
  unlinkTestReportSpreadsheet,
} from '../services/studentTestReportSheetsService.js';

export const getStudentTestReportSheetStatus = async (req, res) => {
  res.json(await getTestReportSheetStatus());
};

export const getStudentTestReportAppsScriptSetup = async (req, res) => {
  res.json(await getTestReportAppsScriptSetup(req));
};

export const linkStudentTestReportSheet = async (req, res) => {
  const { spreadsheetUrl } = req.body || {};
  if (!spreadsheetUrl) {
    return res.status(400).json({ message: 'spreadsheetUrl is required' });
  }
  const value = await linkTestReportSpreadsheet(spreadsheetUrl);
  res.status(201).json({
    linked: true,
    spreadsheetUrl: value.spreadsheetUrl,
    linkedAt: value.linkedAt,
  });
};

export const unlinkStudentTestReportSheet = async (req, res) => {
  await unlinkTestReportSpreadsheet();
  res.json({ linked: false });
};
