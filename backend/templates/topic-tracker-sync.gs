/**
 * MBU TOMS Topic Tracker sync — Extensions → Apps Script in your Google Sheet
 * Run installTriggers() once after pasting this script.
 *
 * Writes:
 *   1) Master tab "Topic Tracker" with all rows
 *   2) One tab per trainer (named "EmployeeID - Name") with that trainer's rows
 */
const EXPORT_URL = '__EXPORT_URL__';
const API_KEY = '__API_KEY__';
const SHEET_NAME = 'Topic Tracker';
const TRAINER_NAME_COL = 1; // 0-based index in export rows
const TRAINER_ID_COL = 17;

function syncTopicTracker() {
  const url = EXPORT_URL + '?key=' + encodeURIComponent(API_KEY);
  const res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { 'ngrok-skip-browser-warning': 'true' },
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('TOMS API error (' + res.getResponseCode() + '): ' + res.getContentText());
  }

  const payload = JSON.parse(res.getContentText());
  const rows = payload.rows || [];
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  writeSheetValues(ensureSheet(ss, SHEET_NAME), rows);

  if (rows.length < 2) {
    SpreadsheetApp.flush();
    return;
  }

  const header = rows[0];
  const groups = groupRowsByTrainer(rows.slice(1));
  const managedNames = {};
  managedNames[SHEET_NAME] = true;

  Object.keys(groups).forEach(function (key) {
    const group = groups[key];
    const sheetName = sanitizeSheetName(group.sheetName);
    managedNames[sheetName] = true;
    writeSheetValues(ensureSheet(ss, sheetName), [header].concat(group.rows));
  });

  // Remove empty leftover tabs from trainers who no longer appear in the export,
  // but only sheets that look like managed trainer tabs (contain " - ").
  ss.getSheets().forEach(function (sheet) {
    const name = sheet.getName();
    if (managedNames[name]) return;
    if (name === SHEET_NAME) return;
    if (name.indexOf(' - ') === -1) return;
    if (ss.getSheets().length <= 1) return;
    ss.deleteSheet(sheet);
  });

  SpreadsheetApp.flush();
}

function groupRowsByTrainer(dataRows) {
  const groups = {};
  dataRows.forEach(function (row) {
    const trainerId = String(row[TRAINER_ID_COL] || '').trim();
    const trainerName = String(row[TRAINER_NAME_COL] || '').trim();
    const key = trainerId || trainerName || 'Unknown';
    if (!groups[key]) {
      groups[key] = {
        sheetName: trainerId && trainerName
          ? trainerId + ' - ' + trainerName
          : (trainerId || trainerName || 'Unknown'),
        rows: [],
      };
    }
    groups[key].rows.push(row);
  });
  return groups;
}

function ensureSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
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

function writeSheetValues(sheet, rows) {
  sheet.clear();
  if (!rows || !rows.length) {
    sheet.getRange(1, 1).setValue('No topic tracker data returned.');
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
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TOMS Topic Tracker')
    .addItem('Refresh now', 'syncTopicTracker')
    .addToUi();
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncTopicTracker') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('syncTopicTracker')
    .timeBased()
    .everyMinutes(5)
    .create();

  syncTopicTracker();
}
