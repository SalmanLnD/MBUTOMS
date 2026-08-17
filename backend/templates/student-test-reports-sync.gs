/**
 * MBU TOMS Monthly Test Reports sync — Extensions → Apps Script
 * Run installTriggers() once after pasting this script.
 *
 * Writes:
 *   1) Summary tab with subject-wise and class-wise pass rates (all months)
 *   2) One tab per month (e.g. "August 2026") with P/A and marks
 */
const EXPORT_URL = '__EXPORT_URL__';
const API_KEY = '__API_KEY__';
const SUMMARY_SHEET_NAME = 'Summary';

function fetchTomsExport() {
  const url = EXPORT_URL + '?key=' + encodeURIComponent(API_KEY);
  const healthUrl = EXPORT_URL.replace(/\/api\/.+$/, '/api/health');
  const headers = { 'ngrok-skip-browser-warning': 'true' };
  let lastMessage = '';

  for (let attempt = 1; attempt <= 6; attempt++) {
    UrlFetchApp.fetch(healthUrl, { muteHttpExceptions: true, headers: headers });
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: headers });
    const code = response.getResponseCode();
    if (code === 200) {
      return JSON.parse(response.getContentText());
    }
    lastMessage = 'TOMS API error (' + code + '): ' + response.getContentText();
    if (code !== 502 && code !== 503 && code !== 504) {
      throw new Error(lastMessage);
    }
    Utilities.sleep(8000);
  }

  throw new Error(lastMessage || 'TOMS API did not become ready');
}

function syncStudentTestReports() {
  const payload = fetchTomsExport();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const managedNames = {};

  const summaryName = payload.summarySheetName || SUMMARY_SHEET_NAME;
  managedNames[summaryName] = true;
  writeSheetValues(
    ensureSheet(spreadsheet, summaryName),
    payload.summaryRows || []
  );

  (payload.monthSheets || []).forEach(function (monthSheet) {
    const sheetName = sanitizeSheetName(monthSheet.sheetName || monthSheet.month || 'Unknown');
    managedNames[sheetName] = true;
    writeSheetValues(
      ensureSheet(spreadsheet, sheetName),
      monthSheet.rows || []
    );
  });

  cleanupStaleMonthSheets(spreadsheet, managedNames, summaryName);
  SpreadsheetApp.flush();
}

function ensureSheet(spreadsheet, name) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  return sheet;
}

function sanitizeSheetName(name) {
  var cleaned = String(name || 'Unknown')
    .replace(/[:\\\/\?\*\[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) cleaned = 'Unknown';
  if (cleaned.length > 100) cleaned = cleaned.substring(0, 100);
  return cleaned;
}

function cleanupStaleMonthSheets(spreadsheet, managedNames, summaryName) {
  spreadsheet.getSheets().forEach(function (sheet) {
    const name = sheet.getName();
    if (managedNames[name]) return;
    if (name === summaryName) return;
    if (spreadsheet.getSheets().length <= 1) return;
    spreadsheet.deleteSheet(sheet);
  });
}

function writeSheetValues(sheet, rows) {
  sheet.clear();
  if (!rows.length) {
    sheet.getRange(1, 1).setValue('No monthly test report data returned.');
    return;
  }

  const maxColumns = rows.reduce(function (max, row) {
    return Math.max(max, row.length);
  }, 1);
  const maxRows = rows.length;

  if (sheet.getMaxColumns() < maxColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), maxColumns - sheet.getMaxColumns());
  }
  if (sheet.getMaxRows() < maxRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), maxRows - sheet.getMaxRows());
  }

  const padded = rows.map(function (row) {
    const copy = row.slice();
    while (copy.length < maxColumns) copy.push('');
    return copy;
  });
  sheet.getRange(1, 1, maxRows, maxColumns).setValues(padded);

  const headerRow = findHeaderRowIndex(rows);
  if (headerRow >= 0) {
    sheet.getRange(headerRow + 1, 1, 1, maxColumns)
      .setFontWeight('bold')
      .setBackground('#d9ead3');
    sheet.setFrozenRows(headerRow + 1);
  }

  sheet.autoResizeColumns(1, maxColumns);
}

function findHeaderRowIndex(rows) {
  for (var i = 0; i < rows.length; i += 1) {
    const firstCell = String(rows[i][0] || '').trim().toLowerCase();
    if (firstCell === 'month' || firstCell === 'subject') return i;
  }
  return rows.length ? 0 : -1;
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncStudentTestReports') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('syncStudentTestReports')
    .timeBased()
    .everyMinutes(5)
    .create();
  syncStudentTestReports();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TOMS Test Reports')
    .addItem('Refresh now', 'syncStudentTestReports')
    .addItem('Install 5-minute refresh', 'installTriggers')
    .addToUi();
}
