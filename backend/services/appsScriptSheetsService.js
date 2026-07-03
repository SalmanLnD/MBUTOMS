import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AppSetting from '../models/AppSetting.js';
import { buildTimetableExportPayload } from '../utils/timetableExport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPREADSHEET_SETTING_KEY = 'timetable_spreadsheet';
const EXPORT_KEY_SETTING = 'timetable_export_api_key';

const getExportKey = async () => {
  const setting = await AppSetting.findOne({ key: EXPORT_KEY_SETTING }).lean();
  return setting?.value || null;
};

export const getOrCreateExportKey = async () => {
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

export const validateExportKey = async (key) => {
  const stored = await getExportKey();
  return Boolean(stored && key && key === stored);
};

export const getPublicApiBaseUrl = (req) => {
  const configured = process.env.API_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
};

export const getLinkedSheet = async () => {
  const setting = await AppSetting.findOne({ key: SPREADSHEET_SETTING_KEY }).lean();
  return setting?.value || null;
};

const saveLinkedSheet = async (value) => {
  await AppSetting.findOneAndUpdate(
    { key: SPREADSHEET_SETTING_KEY },
    { key: SPREADSHEET_SETTING_KEY, value },
    { upsert: true, new: true }
  );
  return value;
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

export const getAppsScriptStatus = async () => {
  const linked = await getLinkedSheet();
  const exportKey = await getExportKey();
  return {
    mode: 'apps_script',
    linked: Boolean(linked?.spreadsheetUrl),
    spreadsheetUrl: linked?.spreadsheetUrl || null,
    linkedAt: linked?.linkedAt || null,
    exportReady: Boolean(exportKey),
  };
};

export const getAppsScriptSetup = async (req) => {
  const apiKey = await getOrCreateExportKey();
  const baseUrl = getPublicApiBaseUrl(req);
  const exportUrl = `${baseUrl}/api/sheets/timetable/export`;

  const templatePath = path.join(__dirname, '../templates/timetable-sync.gs');
  const template = fs.readFileSync(templatePath, 'utf8');
  const script = template
    .replaceAll('__EXPORT_URL__', exportUrl)
    .replaceAll('__API_KEY__', apiKey);

  return {
    exportUrl,
    apiKey,
    script,
    steps: [
      'Create a new Google Sheet (sheets.google.com) while signed in as campus manager.',
      'Extensions → Apps Script, delete any sample code, paste the script below, and save.',
      'Run installTriggers once (authorize when Google asks).',
      'Use menu TOMS Timetable → Refresh now to test.',
      'Paste your sheet URL below and click Save link.',
    ],
    note:
      'Google Apps Script runs on Google servers and cannot call localhost. '
      + 'Use your deployed API URL (set API_PUBLIC_URL in backend .env) or a tunnel like ngrok for local testing.',
  };
};

export const linkSpreadsheetUrl = async (spreadsheetUrl) => {
  const url = normalizeSpreadsheetUrl(spreadsheetUrl);
  return saveLinkedSheet({
    mode: 'apps_script',
    spreadsheetUrl: url,
    linkedAt: new Date().toISOString(),
  });
};

export const unlinkSpreadsheet = async () => {
  await AppSetting.deleteOne({ key: SPREADSHEET_SETTING_KEY });
  return { unlinked: true };
};

export const exportTimetableRows = async () => buildTimetableExportPayload();
