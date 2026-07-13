/**
 * Removes duplicate schedule slots that exist under multiple codes for the
 * same trainer (e.g. Ashwini owning identical slots as both employeeId
 * "801777" and legacy code "PSTP-T8").
 *
 * Keeps the slot registered under a legacy scheduleTrainerCode (source of
 * truth for synced timetables) and deletes the employeeId-coded duplicate,
 * remapping any Leave/Attendance references to the kept slot first.
 *
 * Usage: node scripts/remove-duplicate-trainer-code-slots.mjs [--dry-run]
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Trainer from '../models/Trainer.js';
import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Attendance from '../models/Attendance.js';
import { resolveTrainerScheduleCodes } from '../utils/trainerMappings.js';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

const slotIdentityKey = (s) =>
  [s.day, s.startTime, s.endTime, s.department || '', s.section || '', s.subjectCode || '', s.semester || ''].join('|');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const trainers = await Trainer.find().select('name employeeId scheduleTrainerCodes').lean();
  const codeToTrainer = new Map();
  trainers.forEach((trainer) => {
    resolveTrainerScheduleCodes(trainer).forEach((code) => codeToTrainer.set(code, trainer));
  });

  const schedules = await Schedule.find().lean();

  const byTrainerSlot = new Map();
  schedules.forEach((schedule) => {
    const trainer = codeToTrainer.get(schedule.trainerCode);
    if (!trainer) return;
    const key = `${trainer._id}|${slotIdentityKey(schedule)}`;
    if (!byTrainerSlot.has(key)) byTrainerSlot.set(key, []);
    byTrainerSlot.get(key).push({ schedule, trainer });
  });

  const removals = [];
  for (const group of byTrainerSlot.values()) {
    if (group.length < 2) continue;
    const { trainer } = group[0];
    const legacyCodes = new Set(trainer.scheduleTrainerCodes || []);

    // Prefer keeping the legacy-coded slot (synced source of truth); otherwise keep the first.
    const sorted = [...group].sort((a, b) => {
      const aLegacy = legacyCodes.has(a.schedule.trainerCode) ? 0 : 1;
      const bLegacy = legacyCodes.has(b.schedule.trainerCode) ? 0 : 1;
      return aLegacy - bLegacy;
    });
    const keep = sorted[0].schedule;
    sorted.slice(1).forEach(({ schedule }) => {
      removals.push({ trainer, keep, remove: schedule });
    });
  }

  if (!removals.length) {
    console.log('No duplicate cross-code slots found.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${removals.length} duplicate slot(s) to remove:`);
  removals.forEach(({ trainer, keep, remove }) => {
    console.log(
      `  ${trainer.name} (${trainer.employeeId}): remove [${remove.trainerCode}] ${remove.day} ${remove.startTime}-${remove.endTime} ${remove.department} ${remove.section}, keep [${keep.trainerCode}] ${keep._id}`
    );
  });

  if (DRY_RUN) {
    console.log('\nDry run: no changes made.');
    await mongoose.disconnect();
    return;
  }

  for (const { keep, remove } of removals) {
    const leavesAffected = await Leave.updateMany(
      { affectedSchedules: remove._id },
      { $set: { 'affectedSchedules.$[el]': keep._id } },
      { arrayFilters: [{ el: remove._id }] }
    );
    const leavesReplacement = await Leave.updateMany(
      { 'replacements.schedule': remove._id },
      { $set: { 'replacements.$[el].schedule': keep._id } },
      { arrayFilters: [{ 'el.schedule': remove._id }] }
    );
    const attendance = await Attendance.updateMany(
      { schedule: remove._id },
      { $set: { schedule: keep._id } }
    );
    await Schedule.deleteOne({ _id: remove._id });

    const remapped = [];
    if (leavesAffected.modifiedCount) remapped.push(`${leavesAffected.modifiedCount} leave affectedSchedules`);
    if (leavesReplacement.modifiedCount) remapped.push(`${leavesReplacement.modifiedCount} leave replacements`);
    if (attendance.modifiedCount) remapped.push(`${attendance.modifiedCount} attendance record(s)`);
    console.log(`Deleted ${remove._id}${remapped.length ? ` (remapped ${remapped.join(', ')})` : ''}`);
  }

  console.log(`\nRemoved ${removals.length} duplicate slot(s).`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
