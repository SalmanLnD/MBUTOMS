import {
  getAppsScriptStatus,
  getAppsScriptSetup,
  linkSpreadsheetUrl,
  unlinkSpreadsheet,
  exportTimetableRows,
} from '../services/appsScriptSheetsService.js';

export const getTimetableSheetStatus = async (req, res) => {
  res.json(await getAppsScriptStatus());
};

export const getTimetableAppsScriptSetup = async (req, res) => {
  res.json(await getAppsScriptSetup(req));
};

export const linkTimetableSheet = async (req, res) => {
  const { spreadsheetUrl } = req.body || {};
  if (!spreadsheetUrl) {
    return res.status(400).json({ message: 'spreadsheetUrl is required' });
  }
  const value = await linkSpreadsheetUrl(spreadsheetUrl);
  res.status(201).json({
    linked: true,
    spreadsheetUrl: value.spreadsheetUrl,
    linkedAt: value.linkedAt,
  });
};

export const exportTimetableForSheets = async (req, res) => {
  const payload = await exportTimetableRows();
  res.json(payload);
};

export const unlinkTimetableSheet = async (req, res) => {
  await unlinkSpreadsheet();
  res.json({ linked: false });
};
