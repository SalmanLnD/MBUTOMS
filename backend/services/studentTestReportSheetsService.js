import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AppSetting from '../models/AppSetting.js';
import { getPublicApiBaseUrl } from './appsScriptSheetsService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPREADSHEET_SETTING_KEY = 'student_test_reports_spreadsheet';
const EXPORT_KEY_SETTING = 'student_test_reports_export_api_key';

const getExportKey = async () => {
  const setting = await AppSetting.findOne({ key: EXPORT_KEY_SETTING }).lean();
  return setting?.value || null;
};

export const getOrCreateTestReportExportKey = async () => {
  const existing = await getExportKey();
  if (existing) return existing;

  const key = crypto.randomBytes(24).toString('hex');
  await AppSetting.findOneAndUpdate(
    { key: EXPORT_KEY_SETTING },
    { key: EXPORT_KEY_SETTING, value: key },
    { upsert: true, new: true }
  );
  return key;
};

export const validateTestReportExportKey = async (key) => {
  const stored = await getExportKey();
  return Boolean(stored && key && key === stored);
};

const getLinkedSheet = async () => {
  const setting = await AppSetting.findOne({ key: SPREADSHEET_SETTING_KEY }).lean();
  return setting?.value || null;
};

const normalizeSpreadsheetUrl = (url) => {
  const trimmed = String(url || '').trim();
  if (!trimmed.includes('docs.google.com/spreadsheets')) {
    const error = new Error('Paste a valid Google Sheets URL (docs.google.com/spreadsheets/...).');
    error.statusCode = 400;
    throw error;
  }
  return trimmed.split('#')[0].split('?')[0];
};

export const getTestReportSheetStatus = async () => {
  const [linked, exportKey] = await Promise.all([getLinkedSheet(), getExportKey()]);
  return {
    mode: 'apps_script',
    linked: Boolean(linked?.spreadsheetUrl),
    spreadsheetUrl: linked?.spreadsheetUrl || null,
    linkedAt: linked?.linkedAt || null,
    exportReady: Boolean(exportKey),
  };
};

export const getTestReportAppsScriptSetup = async (req) => {
  const apiKey = await getOrCreateTestReportExportKey();
  const exportUrl = `${getPublicApiBaseUrl(req)}/api/student-test-reports/export`;
  const templatePath = path.join(__dirname, '../templates/student-test-reports-sync.gs');
  const template = fs.readFileSync(templatePath, 'utf8');
  const script = template
    .replaceAll('__EXPORT_URL__', exportUrl)
    .replaceAll('__API_KEY__', apiKey);

  return {
    exportUrl,
    apiKey,
    script,
    steps: [
      'Create one Google Sheet for monthly test reports.',
      'Extensions → Apps Script, delete sample code, paste the script below, and save.',
      'Run installTriggers once and authorize access when Google asks.',
      'Use menu TOMS Test Reports → Refresh now to sync the Summary tab plus one tab per month.',
      'Paste the Google Sheet URL below and click Save link.',
    ],
    note:
      'The sheet refreshes every 5 minutes. Summary aggregates all months; each month tab '
      + 'lists student marks with P/A (Present/Absent). Re-paste the Apps Script after '
      + 'deployments if the sync format changed. Google Apps Script cannot call localhost; '
      + 'use the deployed API URL or a tunnel for local testing.',
  };
};

export const linkTestReportSpreadsheet = async (spreadsheetUrl) => {
  const value = {
    mode: 'apps_script',
    spreadsheetUrl: normalizeSpreadsheetUrl(spreadsheetUrl),
    linkedAt: new Date().toISOString(),
  };
  await AppSetting.findOneAndUpdate(
    { key: SPREADSHEET_SETTING_KEY },
    { key: SPREADSHEET_SETTING_KEY, value },
    { upsert: true, new: true }
  );
  return value;
};

export const unlinkTestReportSpreadsheet = async () => {
  await AppSetting.deleteOne({ key: SPREADSHEET_SETTING_KEY });
  return { unlinked: true };
};
