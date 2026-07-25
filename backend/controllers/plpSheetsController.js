import {
  exportPlpForSheets,
  getPlpAppsScriptSetup,
  getPlpSheetStatus,
  linkPlpSpreadsheet,
  unlinkPlpSpreadsheet,
} from '../services/plpSheetsService.js';

export const exportPlpSheetData = async (req, res) => {
  res.json(await exportPlpForSheets());
};

export const getPlpGoogleSheetStatus = async (req, res) => {
  res.json(await getPlpSheetStatus());
};

export const getPlpGoogleAppsScriptSetup = async (req, res) => {
  res.json(await getPlpAppsScriptSetup(req));
};

export const linkPlpGoogleSheet = async (req, res) => {
  const { spreadsheetUrl } = req.body || {};
  if (!spreadsheetUrl) {
    return res.status(400).json({ message: 'spreadsheetUrl is required' });
  }
  const value = await linkPlpSpreadsheet(spreadsheetUrl);
  res.status(201).json({
    linked: true,
    spreadsheetUrl: value.spreadsheetUrl,
    linkedAt: value.linkedAt,
  });
};

export const unlinkPlpGoogleSheet = async (req, res) => {
  await unlinkPlpSpreadsheet();
  res.json({ linked: false });
};
