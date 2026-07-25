/**
 * MBU TOMS PLP sync — Extensions → Apps Script in your Google Sheet
 * Run installTriggers() once after pasting this script.
 *
 * Creates one tab per PLP cycle named like "June-July 2026".
 */
const EXPORT_URL = '__EXPORT_URL__';
const API_KEY = '__API_KEY__';
const LEGACY_SHEET_NAME = 'PLP';

function syncPlp() {
  const url = EXPORT_URL + '?key=' + encodeURIComponent(API_KEY);
  const res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { 'ngrok-skip-browser-warning': 'true' },
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('TOMS API error (' + res.getResponseCode() + '): ' + res.getContentText());
  }

  const payload = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = payload.sheets || [];
  const managedNames = {};

  if (!sheets.length) {
    const fallback = ensureSheet(ss, LEGACY_SHEET_NAME);
    writeSheetValues(fallback, [['No PLP cycle sheets returned.']]);
    SpreadsheetApp.flush();
    return;
  }

  sheets.forEach(function (entry) {
    const sheetName = sanitizeSheetName(entry.sheetName || entry.cycleKey || 'PLP');
    managedNames[sheetName] = true;
    writeSheetValues(ensureSheet(ss, sheetName), entry.rows || []);
  });

  // Remove the old single "PLP" tab and any prior cycle tabs no longer exported.
  ss.getSheets().forEach(function (sheet) {
    const name = sheet.getName();
    if (managedNames[name]) return;
    if (!isManagedPlpSheetName(name)) return;
    if (ss.getSheets().length <= 1) return;
    ss.deleteSheet(sheet);
  });

  SpreadsheetApp.flush();
}

function isManagedPlpSheetName(name) {
  if (name === LEGACY_SHEET_NAME) return true;
  // e.g. June-July 2026 or December-January 2027
  return /^[A-Za-z]+-[A-Za-z]+ \d{4}$/.test(String(name || ''));
}

function ensureSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function sanitizeSheetName(name) {
  var cleaned = String(name || 'PLP')
    .replace(/[:\\\/\?\*\[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) cleaned = 'PLP';
  if (cleaned.length > 100) cleaned = cleaned.substring(0, 100);
  return cleaned;
}

function writeSheetValues(sheet, rows) {
  sheet.clear();
  if (!rows || !rows.length) {
    sheet.getRange(1, 1).setValue('No PLP rows for this cycle.');
    return;
  }

  const maxCols = rows.reduce(function (max, row) {
    return Math.max(max, row.length);
  }, 1);
  const padded = rows.map(function (row) {
    const copy = row.slice();
    while (copy.length < maxCols) {
      copy.push('');
    }
    return copy;
  });

  sheet.getRange(1, 1, padded.length, maxCols).setValues(padded);
  sheet.getRange(1, 1, 1, maxCols).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TOMS PLP')
    .addItem('Refresh now', 'syncPlp')
    .addToUi();
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncPlp') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('syncPlp')
    .timeBased()
    .everyMinutes(5)
    .create();

  syncPlp();
}
