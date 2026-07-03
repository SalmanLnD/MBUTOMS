import Trainer from '../models/Trainer.js';
import Schedule from '../models/Schedule.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';
import { SLOT_KEYS } from './timetableSlots.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const cellText = (schedule) => {
  if (!schedule) return '';
  const parts = [];
  if (schedule.subjectCode) parts.push(schedule.subjectCode);
  const classLabel = [schedule.department, schedule.section].filter(Boolean).join(' ');
  if (classLabel) parts.push(classLabel);
  if (schedule.startTime && schedule.endTime) {
    parts.push(`${schedule.startTime}-${schedule.endTime}`);
  }
  if (schedule.replacementFor?.trainerName) {
    parts.push(`(for ${schedule.replacementFor.trainerName})`);
  }
  return parts.join('\n');
};

const pickSlotForCell = (schedules, day, slotKey) => {
  const daySchedules = schedules.filter((item) => item.day === day);
  const bySlot = daySchedules.find((item) => item.slot === slotKey);
  if (bySlot) return bySlot;

  const index = SLOT_KEYS.indexOf(slotKey);
  const withoutSlot = daySchedules.filter((item) => !item.slot);
  return withoutSlot[index] || null;
};

/**
 * Builds a printable grid for every trainer:
 * header row + one row per (day) with S1/S2/S3 columns.
 * Returns an array of { trainer, rows } where rows is a 2D array of strings.
 */
export const buildTimetableExport = async () => {
  const trainers = await Trainer.find().sort({ employeeId: 1 }).lean();
  const allSchedules = await Schedule.find().lean();

  const sections = [];

  for (const trainer of trainers) {
    const codes = resolveTrainerScheduleCodes(trainer);
    const codeSet = new Set(codes);
    const schedules = allSchedules.filter((item) => codeSet.has(item.trainerCode));

    if (!schedules.length) continue;

    const header = ['Day', ...SLOT_KEYS];
    const rows = [header];

    for (const day of DAYS) {
      const row = [day];
      for (const slotKey of SLOT_KEYS) {
        row.push(cellText(pickSlotForCell(schedules, day, slotKey)));
      }
      rows.push(row);
    }

    const title = trainer.name && trainer.name !== trainer.employeeId
      ? `${trainer.name} (${trainer.employeeId})`
      : trainer.employeeId;

    sections.push({ trainer, title, rows, slotCount: schedules.length });
  }

  return sections;
};

export const buildTimetableExportPayload = async () => {
  const sections = await buildTimetableExport();
  const rows = [];
  rows.push([`MBU Timetable — last updated ${new Date().toLocaleString('en-IN')}`]);
  rows.push([]);

  sections.forEach((section) => {
    rows.push([`${section.title}  ·  ${section.slotCount} slot(s)`]);
    section.rows.forEach((row) => rows.push(row));
    rows.push([]);
    rows.push([]);
  });

  if (sections.length === 0) {
    rows.push(['No timetable slots have been added yet.']);
  }

  return {
    updatedAt: new Date().toISOString(),
    trainerCount: sections.length,
    rows,
  };
};
