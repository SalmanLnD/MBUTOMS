/**
 * MBU TOMS Trainer Attendance sync — Extensions → Apps Script
 * Run installTriggers() once after pasting this script.
 */
const EXPORT_URL = '__EXPORT_URL__';
const API_KEY = '__API_KEY__';
const DEFAULT_SHEET_NAME = 'Trainer Attendance from July 13';

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

function syncTrainerAttendance() {
  const payload = fetchTomsExport();
  const rows = payload.rows || [];
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = payload.sheetName || DEFAULT_SHEET_NAME;
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (!rows.length) {
    sheet.clear();
    sheet.getRange(1, 1).setValue('No trainer attendance returned.');
    return;
  }

  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 1);
  const maxRows = rows.length;
  if (sheet.getMaxColumns() < maxColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), maxColumns - sheet.getMaxColumns());
  }
  if (sheet.getMaxRows() < maxRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), maxRows - sheet.getMaxRows());
  }

  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();

  const padded = rows.map((row) => {
    const copy = row.slice();
    while (copy.length < maxColumns) copy.push('');
    return copy;
  });
  sheet.getRange(1, 1, maxRows, maxColumns).setValues(padded);

  const groupSize = payload.dateGroupSize || 4;
  for (let column = 3; column <= maxColumns; column += groupSize) {
    sheet.getRange(1, column, 1, groupSize).merge();
  }

  sheet.setFrozenRows(payload.frozenRows || 2);
  sheet.setFrozenColumns(payload.frozenColumns || 2);

  const usedRange = sheet.getRange(1, 1, maxRows, maxColumns);
  usedRange
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true)
    .setBorder(true, true, true, true, true, true);

  sheet.getRange(1, 1, 2, maxColumns)
    .setFontWeight('bold')
    .setBackground('#d9ead3');
  sheet.getRange(3, 1, Math.max(maxRows - 2, 1), 2).setFontWeight('bold');
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 100);
  if (maxColumns > 2) {
    sheet.setColumnWidths(3, maxColumns - 2, 90);
  }

  SpreadsheetApp.flush();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TOMS Attendance')
    .addItem('Refresh now', 'syncTrainerAttendance')
    .addToUi();
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'syncTrainerAttendance') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('syncTrainerAttendance')
    .timeBased()
    .everyMinutes(5)
    .create();

  syncTrainerAttendance();
}
