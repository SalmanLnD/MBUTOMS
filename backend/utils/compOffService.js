import CompOff, { COMP_OFF_STATUSES } from '../models/CompOff.js';
import Trainer from '../models/Trainer.js';
import { COMP_OFF_SEED_ROWS } from '../data/compOffSeedData.js';
import { normalizeDate } from './scheduleHelpers.js';

const COMP_OFF_DAY_UNITS = 1;

const roundCount = (value) => Math.round(Number(value || 0) * 10) / 10;

export const buildCompOffRowKey = (row) =>
  `${row.employeeId}|${normalizeDate(row.dateWorkedOn).toISOString().slice(0, 10)}|${row.uniqueId}|${row.count}`;

export const annotateCompOffRows = (rows) => {
  const duplicateCounts = new Map();
  const nameToEmployeeIds = new Map();

  rows.forEach((row) => {
    const key = buildCompOffRowKey(row);
    duplicateCounts.set(key, (duplicateCounts.get(key) || 0) + 1);
    if (!nameToEmployeeIds.has(row.name)) nameToEmployeeIds.set(row.name, new Set());
    nameToEmployeeIds.get(row.name).add(row.employeeId);
  });

  const multiEmployeeIdNames = new Set(
    [...nameToEmployeeIds.entries()]
      .filter(([, employeeIds]) => employeeIds.size > 1)
      .map(([name]) => name)
  );

  return rows.map((row) => ({
    ...row,
    isDuplicate: (duplicateCounts.get(buildCompOffRowKey(row)) || 0) > 1,
    hasMultipleEmployeeIds: multiEmployeeIdNames.has(row.name),
  }));
};

export const buildCompOffSummaryByEmployee = (rows) => {
  const annotated = annotateCompOffRows(rows);
  const byEmployee = new Map();

  annotated.forEach((row) => {
    const key = row.employeeId;
    if (!byEmployee.has(key)) {
      byEmployee.set(key, {
        employeeId: row.employeeId,
        name: row.name,
        base: row.base,
        trainer: row.trainer || null,
        totalCount: 0,
        pendingCount: 0,
        closedCount: 0,
        recordCount: 0,
        pendingRecords: 0,
        closedRecords: 0,
        duplicateRecords: 0,
        hasMultipleEmployeeIds: row.hasMultipleEmployeeIds,
      });
    }
    const summary = byEmployee.get(key);
    summary.recordCount += 1;
    summary.totalCount = roundCount(summary.totalCount + row.count);
    if (row.isDuplicate) summary.duplicateRecords += 1;
    if (row.status === COMP_OFF_STATUSES.PENDING) {
      summary.pendingRecords += 1;
      summary.pendingCount = roundCount(summary.pendingCount + row.count);
    } else {
      summary.closedRecords += 1;
      summary.closedCount = roundCount(summary.closedCount + row.count);
    }
  });

  return [...byEmployee.values()].sort((a, b) => a.employeeId.localeCompare(b.employeeId));
};

export const buildTrainerCompOffSummary = (rows) => {
  const annotated = annotateCompOffRows(rows);
  const pendingRows = annotated.filter((row) => row.status === COMP_OFF_STATUSES.PENDING);
  const closedRows = annotated.filter((row) => row.status === COMP_OFF_STATUSES.CLOSED);

  return {
    pendingBalance: roundCount(pendingRows.reduce((sum, row) => sum + row.count, 0)),
    pendingRecords: pendingRows.length,
    closedRecords: closedRows.length,
    totalRecords: annotated.length,
    duplicateRecords: annotated.filter((row) => row.isDuplicate).length,
    hasMultipleEmployeeIds: annotated.some((row) => row.hasMultipleEmployeeIds),
  };
};

const resolveTrainerEmployeeId = async (trainerId) => {
  const trainer = await Trainer.findById(trainerId).select('employeeId').lean();
  return trainer?.employeeId || null;
};

const pendingSort = { dateWorkedOn: 1, uniqueId: 1, createdAt: 1 };

export const getPendingCompOffBalance = async ({ trainerId, employeeId }) => {
  const resolvedEmployeeId = employeeId || await resolveTrainerEmployeeId(trainerId);
  if (!resolvedEmployeeId) return 0;

  const rows = await CompOff.find({
    employeeId: resolvedEmployeeId,
    status: COMP_OFF_STATUSES.PENDING,
  })
    .select('count')
    .lean();

  return roundCount(rows.reduce((sum, row) => sum + row.count, 0));
};

export const consumeCompOffForAttendance = async ({ trainerId, attendanceDate, units = COMP_OFF_DAY_UNITS }) => {
  const employeeId = await resolveTrainerEmployeeId(trainerId);
  if (!employeeId) {
    const error = new Error('Trainer profile is not linked to an employee ID.');
    error.statusCode = 400;
    throw error;
  }

  const pendingRows = await CompOff.find({
    employeeId,
    status: COMP_OFF_STATUSES.PENDING,
  }).sort(pendingSort);

  const available = roundCount(pendingRows.reduce((sum, row) => sum + row.count, 0));
  if (available < units) {
    const error = new Error(
      `Insufficient comp-off balance. Available: ${available}, required: ${units}.`
    );
    error.statusCode = 400;
    error.code = 'INSUFFICIENT_COMP_OFF';
    error.availableBalance = available;
    throw error;
  }

  const day = normalizeDate(attendanceDate);
  let remaining = units;
  const consumedIds = [];

  for (const row of pendingRows) {
    if (remaining <= 0) break;
    if (row.count > remaining) {
      const error = new Error('Comp-off records must be consumed in whole-row units.');
      error.statusCode = 500;
      throw error;
    }

    row.status = COMP_OFF_STATUSES.CLOSED;
    row.availedOn = day;
    if (!row.trainer) row.trainer = trainerId;
    await row.save();
    consumedIds.push(row._id.toString());
    remaining = roundCount(remaining - row.count);
  }

  if (remaining > 0) {
    const error = new Error('Unable to allocate comp-off balance for this attendance day.');
    error.statusCode = 500;
    throw error;
  }

  return consumedIds;
};

export const releaseCompOffForAttendance = async ({ trainerId, attendanceDate }) => {
  const employeeId = await resolveTrainerEmployeeId(trainerId);
  if (!employeeId) return [];

  const day = normalizeDate(attendanceDate);
  const rows = await CompOff.find({
    employeeId,
    status: COMP_OFF_STATUSES.CLOSED,
    availedOn: day,
  }).sort({ dateWorkedOn: 1, uniqueId: 1, createdAt: 1 });

  for (const row of rows) {
    row.status = COMP_OFF_STATUSES.PENDING;
    row.availedOn = null;
    await row.save();
  }

  return rows.map((row) => row._id.toString());
};

let seedPromise = null;

export const ensureCompOffSeedData = async () => {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const existing = await CompOff.estimatedDocumentCount();
    if (existing > 0) return { seeded: false, count: existing };

    const trainers = await Trainer.find().select('_id employeeId').lean();
    const trainerByEmployeeId = new Map(
      trainers.map((trainer) => [trainer.employeeId, trainer._id])
    );

    const docs = COMP_OFF_SEED_ROWS.map((row) => ({
      trainer: trainerByEmployeeId.get(row.employeeId) || null,
      employeeId: row.employeeId,
      name: row.name,
      base: row.base,
      dateWorkedOn: normalizeDate(row.dateWorkedOn),
      uniqueId: row.uniqueId,
      count: row.count,
      status: COMP_OFF_STATUSES.PENDING,
      availedOn: null,
    }));

    await CompOff.insertMany(docs);
    return { seeded: true, count: docs.length };
  })();

  return seedPromise;
};
