import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workbookPath = path.resolve(__dirname, '../../../Trainer_Wise_III_Sem_Timetables_Merged.xlsx');
const outputPath = path.resolve(__dirname, '../data/schedules-iii-sem.json');

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const normalizeTrainerCode = (name) => name.replace(/\s+/g, ' ').trim();

const to24Hour = (timeStr, forcePM = false) => {
  const [h, m] = timeStr.trim().split(':').map(Number);
  let hour = h;
  if (forcePM || (hour >= 1 && hour <= 7)) {
    hour += 12;
  }
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const parseTimeRange = (slot) => {
  const [startRaw, endRaw] = slot.split('-').map((s) => s.trim());
  const startHour = parseInt(startRaw.split(':')[0], 10);
  const endHour = parseInt(endRaw.split(':')[0], 10);
  const endForcePM = endHour < startHour;
  return {
    startTime: to24Hour(startRaw),
    endTime: to24Hour(endRaw, endForcePM),
  };
};

const parseDepartmentSection = (value) => {
  const text = String(value).trim();
  const parts = text.split(/\s+/);
  if (parts.length >= 2) {
    return { department: parts[0], section: parts.slice(1).join(' ') };
  }
  return { department: text, section: '' };
};

const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
};

export const extractSchedulesFromWorkbook = async (filePath = workbookPath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const schedules = [];
  const trainerCodes = [];

  for (const sheet of workbook.worksheets) {
    const trainerCode = normalizeTrainerCode(sheet.name);
    trainerCodes.push(trainerCode);

    const headerRow = sheet.getRow(1);
    const dayColumns = [];

    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber === 1) return;
      const day = String(cell.value).trim();
      if (WEEKDAYS.includes(day)) {
        dayColumns.push({ col: colNumber, day });
      }
    });

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;

      const timeCell = row.getCell(1).value;
      if (!timeCell || String(timeCell).trim() === '') return;

      const { startTime, endTime } = parseTimeRange(String(timeCell).trim());

      for (const { col, day } of dayColumns) {
        const cellValue = row.getCell(col).value;
        if (isEmpty(cellValue)) continue;

        const { department, section } = parseDepartmentSection(cellValue);

        schedules.push({
          trainerCode,
          day,
          startTime,
          endTime,
          department,
          section,
          semester: 'III',
        });
      }
    });
  }

  return { schedules, trainerCodes: [...new Set(trainerCodes)] };
};

const run = async () => {
  const { schedules, trainerCodes } = await extractSchedulesFromWorkbook();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(schedules, null, 2));

  console.log(`Extracted ${schedules.length} schedule entries from ${trainerCodes.length} trainers`);
  console.log(`JSON written to ${outputPath}`);
  console.log('Trainers:', trainerCodes.join(', '));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
