import CompOff, { COMP_OFF_STATUSES } from '../models/CompOff.js';
import Trainer from '../models/Trainer.js';
import { FULL_ACCESS_ROLES, isTrainerLikeRole } from '../utils/roles.js';
import { normalizeDate } from '../utils/scheduleHelpers.js';
import {
  annotateCompOffRows,
  buildCompOffSummaryByEmployee,
  buildTrainerCompOffSummary,
  ensureCompOffSeedData,
  getCompOffTrainerFilter,
  resolveCompOffRows,
} from '../utils/compOffService.js';
import { escapeRegex } from '../utils/regex.js';

const hasFullAccess = (role) => FULL_ACCESS_ROLES.includes(role);

const toPlainRow = (doc) => {
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    _id: row._id,
    trainer: row.trainer,
    employeeId: row.trainer?.employeeId || row.employeeId,
    name: row.trainer?.name || row.name,
    base: row.base,
    dateWorkedOn: row.dateWorkedOn,
    uniqueId: row.uniqueId,
    count: row.count,
    status: row.status,
    availedOn: row.availedOn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const buildListFilter = async (req) => {
  const filter = {};

  if (isTrainerLikeRole(req.user.role)) {
    const trainer = await Trainer.findById(req.user.trainer).select('_id employeeId name').lean();
    if (!trainer?.employeeId) {
      return { impossible: true };
    }
    filter.$and = [await getCompOffTrainerFilter(trainer)];
  } else if (req.query.employeeId?.trim()) {
    const employeeId = String(req.query.employeeId).trim();
    const trainer = await Trainer.findOne({ employeeId }).select('_id employeeId name').lean();
    filter.$and = [trainer ? await getCompOffTrainerFilter(trainer) : { employeeId }];
  }

  if (req.query.trainer) {
    const trainer = await Trainer.findById(req.query.trainer).select('_id employeeId name').lean();
    if (!trainer) return { impossible: true };
    (filter.$and ||= []).push(await getCompOffTrainerFilter(trainer));
  }

  if (req.query.name?.trim()) {
    const escaped = escapeRegex(String(req.query.name).trim());
    if (escaped) filter.name = { $regex: escaped, $options: 'i' };
  }

  if (req.query.base?.trim()) {
    const escaped = escapeRegex(String(req.query.base).trim());
    if (escaped) filter.base = { $regex: escaped, $options: 'i' };
  }

  if (req.query.status && Object.values(COMP_OFF_STATUSES).includes(req.query.status)) {
    filter.status = req.query.status;
  }

  if (req.query.from || req.query.to) {
    filter.dateWorkedOn = {};
    if (req.query.from) {
      filter.dateWorkedOn.$gte = normalizeDate(req.query.from);
    }
    if (req.query.to) {
      filter.dateWorkedOn.$lte = normalizeDate(req.query.to);
    }
  }

  return filter;
};

export const listCompOffs = async (req, res) => {
  if (!req.isDemo) await ensureCompOffSeedData();

  const filter = await buildListFilter(req);
  if (filter.impossible) {
    return res.json({ rows: [], summaryByEmployee: [], count: 0 });
  }

  const docs = await CompOff.find(filter)
    .populate('trainer', 'name employeeId')
    .sort({ employeeId: 1, dateWorkedOn: 1, uniqueId: 1, createdAt: 1 })
    .lean();

  const rows = annotateCompOffRows(await resolveCompOffRows(docs));

  const view = String(req.query.view || 'table').trim().toLowerCase();
  if (view === 'summary') {
    return res.json({
      summaryByEmployee: buildCompOffSummaryByEmployee(rows),
      count: rows.length,
    });
  }

  res.json({
    rows,
    summaryByEmployee: buildCompOffSummaryByEmployee(rows),
    count: rows.length,
  });
};

export const getCompOffSummary = async (req, res) => {
  if (!req.isDemo) await ensureCompOffSeedData();

  let employeeId = req.query.employeeId?.trim() || '';
  let trainer;
  if (isTrainerLikeRole(req.user.role)) {
    trainer = await Trainer.findById(req.user.trainer).select('_id employeeId name').lean();
    employeeId = trainer?.employeeId || '';
  } else if (req.params.trainerId) {
    trainer = await Trainer.findById(req.params.trainerId).select('_id employeeId name').lean();
    if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
    employeeId = trainer.employeeId;
  } else if (employeeId) {
    trainer = await Trainer.findOne({ employeeId }).select('_id employeeId name').lean();
  }

  if (!employeeId) {
    return res.json({
      summary: {
        pendingBalance: 0,
        pendingRecords: 0,
        closedRecords: 0,
        totalRecords: 0,
        duplicateRecords: 0,
        hasMultipleEmployeeIds: false,
      },
    });
  }

  const docs = await CompOff.find(trainer ? await getCompOffTrainerFilter(trainer) : { employeeId })
    .sort({ dateWorkedOn: 1, uniqueId: 1, createdAt: 1 })
    .lean();

  res.json({
    employeeId,
    summary: buildTrainerCompOffSummary(await resolveCompOffRows(docs)),
  });
};

export const createCompOff = async (req, res) => {
  if (!hasFullAccess(req.user.role)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const {
    employeeId,
    name,
    base,
    dateWorkedOn,
    uniqueId,
    count,
    status = COMP_OFF_STATUSES.PENDING,
  } = req.body || {};

  if (!employeeId || !name || !base || !dateWorkedOn || !uniqueId) {
    return res.status(400).json({ message: 'Employee ID, name, base, date worked on, and unique ID are required.' });
  }

  const parsedCount = Number(count);
  if (Number.isNaN(parsedCount) || parsedCount <= 0) {
    return res.status(400).json({ message: 'Count must be a positive number.' });
  }

  if (!Object.values(COMP_OFF_STATUSES).includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  const trainer = req.body.trainerId
    ? await Trainer.findById(req.body.trainerId).select('_id employeeId name').lean()
    : await Trainer.findOne({ employeeId: String(employeeId).trim() }).select('_id employeeId name').lean();
  if (req.body.trainerId && !trainer) return res.status(400).json({ message: 'Trainer not found' });

  const doc = await CompOff.create({
    trainer: trainer?._id || null,
    employeeId: trainer?.employeeId || String(employeeId).trim(),
    name: trainer?.name || String(name).trim(),
    base: String(base).trim(),
    dateWorkedOn: normalizeDate(dateWorkedOn),
    uniqueId: String(uniqueId).trim(),
    count: parsedCount,
    status,
    availedOn: status === COMP_OFF_STATUSES.CLOSED && req.body.availedOn
      ? normalizeDate(req.body.availedOn)
      : null,
  });

  const populated = await CompOff.findById(doc._id).populate('trainer', 'name employeeId');
  res.status(201).json(annotateCompOffRows([toPlainRow(populated)])[0]);
};

export const updateCompOff = async (req, res) => {
  if (!hasFullAccess(req.user.role)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const doc = await CompOff.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Comp-off record not found' });

  const { status, availedOn, count, name, base, dateWorkedOn, uniqueId } = req.body || {};

  if (name !== undefined) doc.name = String(name).trim();
  if (base !== undefined) doc.base = String(base).trim();
  if (dateWorkedOn !== undefined) doc.dateWorkedOn = normalizeDate(dateWorkedOn);
  if (uniqueId !== undefined) doc.uniqueId = String(uniqueId).trim();

  if (count !== undefined) {
    const parsedCount = Number(count);
    if (Number.isNaN(parsedCount) || parsedCount <= 0) {
      return res.status(400).json({ message: 'Count must be a positive number.' });
    }
    doc.count = parsedCount;
  }

  if (status !== undefined) {
    if (!Object.values(COMP_OFF_STATUSES).includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }
    doc.status = status;
    if (status === COMP_OFF_STATUSES.PENDING) {
      doc.availedOn = null;
    }
  }

  if (availedOn !== undefined) {
    if (availedOn) {
      doc.availedOn = normalizeDate(availedOn);
      doc.status = COMP_OFF_STATUSES.CLOSED;
    } else {
      doc.availedOn = null;
    }
  }

  const [resolved] = await resolveCompOffRows([doc.toObject()]);
  if (resolved.trainer?._id) {
    doc.trainer = resolved.trainer._id;
    doc.employeeId = resolved.employeeId;
    doc.name = resolved.name;
  }
  await doc.save();
  const populated = await CompOff.findById(doc._id).populate('trainer', 'name employeeId');
  res.json(annotateCompOffRows([toPlainRow(populated)])[0]);
};

export const deleteCompOff = async (req, res) => {
  if (!hasFullAccess(req.user.role)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const doc = await CompOff.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Comp-off record not found' });

  await doc.deleteOne();
  res.json({ message: 'Comp-off record deleted' });
};
