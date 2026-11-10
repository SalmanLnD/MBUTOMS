import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import AcademicTerm from '../models/AcademicTerm.js';
import AcademicPublication from '../models/AcademicPublication.js';
import AcademicTermJob from '../models/AcademicTermJob.js';
import { getTermRepositories } from '../utils/academicTermContext.js';

export const termError = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
export const nextTermKey = (source) => {
  if (source.parity === 'odd') return `${source.academicYear}-even`;
  const year = Number(source.academicYear.slice(0, 4)) + 1;
  return `${year}-${year + 1}-odd`;
};
const ROMAN = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
export function promotionDecision(student, source, target) {
  if (student.status !== 'active') return { action: 'skip' };
  const number = ROMAN.indexOf(String(student.semesterLabel || '').trim().toUpperCase());
  const durations = target.programDurations instanceof Map ? Object.fromEntries(target.programDurations) : target.programDurations || {};
  const duration = Number(durations[student.branch]);
  if (number < 1 || number % 2 !== (source.parity === 'odd' ? 1 : 0)) return { action: 'error', message: `Invalid semester for ${student.rollNumber}` };
  if (!Number.isInteger(duration) || duration < number || duration > 12) return { action: 'error', message: `Set program duration for ${student.branch} (${student.rollNumber})` };
  return number === duration ? { action: 'graduate' } : { action: 'promote', semesterLabel: ROMAN[number + 1] };
}
export const acquireAcademicLease = async (expectedRevision, { waitMs = 0 } = {}) => {
  const lease = randomUUID();
  const deadline = Date.now() + waitMs;
  do {
  const state = await AcademicPublication.findOneAndUpdate({ _id: 'current', revision: expectedRevision,
    $or: [{ lease: null }, { leaseExpiresAt: { $lt: new Date() } }] },
  { $set: { lease, leaseExpiresAt: new Date(Date.now() + 300000) } }, { new: true }).lean();
    if (state) return { state, lease };
    if (Date.now() >= deadline) break;
    const current = await AcademicPublication.findById('current').select('revision').lean();
    if (current?.revision !== expectedRevision) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw termError('Academic data is being updated, or the published semester changed. Reload and retry.');
};
export const releaseAcademicLease = (lease) => AcademicPublication.updateOne({ _id: 'current', lease }, { $set: { lease: null, leaseExpiresAt: null } });

export async function buildPromotionPreview(target) {
  const state = await AcademicPublication.findById('current').lean();
  if (!state) throw termError('Run the academic migration before preparing semesters.');
  const source = await AcademicTerm.findById(state.currentTermId).lean();
  if (target.key !== nextTermKey(source)) throw termError('Only the immediate next semester can be prepared or published.');
  const repositories = await getTermRepositories(source);
  const students = await repositories.models.Student.find().sort({ _id: 1 }).lean();
  const classes = await repositories.models.ClassGroup.find().sort({ _id: 1 }).lean();
  const decisions = students.map(student => ({ student, ...promotionDecision(student, source, target) }));
  const manifest = createHash('sha256').update(JSON.stringify({ students, classes, programDurations: target.programDurations instanceof Map ? Object.fromEntries(target.programDurations) : target.programDurations })).digest('hex');
  const classErrors = classes.filter(cls => cls.status === 'active').flatMap(cls => {
    const number = ROMAN.indexOf(cls.currentSemester);
    const durations = target.programDurations instanceof Map ? Object.fromEntries(target.programDurations) : target.programDurations || {};
    return number < 1 || number % 2 !== (source.parity === 'odd' ? 1 : 0) || !durations[cls.department]
      ? [`Invalid semester or missing program duration for class ${cls.department} ${cls.section}`] : [];
  });
  return { source, state, students, classes, decisions, manifest,
    summary: { promote: decisions.filter(d => d.action === 'promote').length,
      graduate: decisions.filter(d => d.action === 'graduate').length,
      skipped: decisions.filter(d => d.action === 'skip').length,
      errors: [...decisions.filter(d => d.action === 'error').map(d => d.message), ...classErrors], sourceManifest: manifest } };
}

export async function prepareAcademicTerm(target, expectedRevision, { reconcile = false } = {}) {
  const { lease } = await acquireAcademicLease(expectedRevision);
  let leaseDeadline = Date.now() + 300000;
  const keepLease = async () => {
    if (leaseDeadline - Date.now() > 120000) return;
    const state = await AcademicPublication.findOneAndUpdate({ _id: 'current', lease, revision: expectedRevision,
      leaseExpiresAt: { $gt: new Date(Date.now() + 60000) } }, { $set: { leaseExpiresAt: new Date(Date.now() + 300000) } }, { new: true }).lean();
    if (!state) throw termError('Preparation lease expired. Retry preparation.');
    leaseDeadline = new Date(state.leaseExpiresAt).getTime();
  };
  try {
    const preview = await buildPromotionPreview(target);
    if (preview.summary.errors.length) throw termError(preview.summary.errors.slice(0, 10).join('; '), 400);
    const key = `prepare:${target._id}`;
    const prior = await AcademicTermJob.findOne({ key, status: 'completed' }).lean();
    if (prior?.manifest.sourceManifest === preview.manifest && target.preparation?.sourceManifest === preview.manifest) return target.preparation;
    if (prior && prior.manifest.sourceManifest !== preview.manifest && !reconcile) throw termError('Source roster changed after preparation. Preview changes and prepare again with reconciliation enabled.');
    await AcademicTerm.updateOne({ _id: target._id, lifecycle: 'draft' }, { $set: { preparation: null } });
    await AcademicTermJob.findOneAndUpdate({ key }, { $set: { termId: target._id, sourceTermId: preview.source._id, kind: 'prepare', status: 'running' } }, { upsert: true });
    const destination = await getTermRepositories(target);
    const hash = doc => createHash('sha256').update(JSON.stringify(doc)).digest('hex');
    const previous = structuredClone(prior?.manifest.generated || {});
    // Recover snapshots written before an interrupted job saved its manifest.
    // Their checksum also detects manual target edits before any retry writes.
    for (const name of ['Student', 'ClassGroup']) {
      previous[name] ||= {};
      const recovered = await destination.models[name].collection.find({ promotionSourceTermId: preview.source._id }).toArray();
      for (const doc of recovered) {
        const { promotionSnapshotChecksum, ...snapshot } = doc;
        if (!previous[name][String(doc._id)]) {
          if (!promotionSnapshotChecksum || hash(snapshot) !== promotionSnapshotChecksum) throw termError(`Partially prepared ${name} ${doc._id} was edited. Resolve that conflict before retrying.`);
          previous[name][String(doc._id)] = hash(doc);
        }
      }
    }
    for (const [name, rows] of Object.entries(previous)) for (const [id, checksum] of Object.entries(rows)) {
      const doc = await destination.models[name].collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
      if (!doc || hash(doc) !== checksum) throw termError(`Prepared ${name} ${id} was edited. Reconcile that change manually before preparation.`);
    }
    const generated = { Student: {}, ClassGroup: {} };
    const saveSnapshot = async (name, snapshot) => {
      await keepLease();
      const collection = destination.models[name].collection;
      const existing = await collection.findOne({ _id: snapshot._id });
      if (existing && !previous[name]?.[String(snapshot._id)] && !existing.promotionSourceTermId) throw termError(`Target ${name} already contains ${snapshot._id}. Resolve the conflict before preparation.`);
      if (existing && !previous[name]?.[String(snapshot._id)] && existing.promotionSourceTermId) {
        const { promotionSnapshotChecksum, ...generatedSnapshot } = existing;
        if (!promotionSnapshotChecksum || hash(generatedSnapshot) !== promotionSnapshotChecksum) throw termError(`Partially prepared ${name} ${snapshot._id} was edited. Resolve that conflict before retrying.`);
      }
      delete snapshot.promotionSnapshotChecksum;
      const replacement = { ...snapshot, termId: target._id, promotionSourceTermId: preview.source._id };
      replacement.promotionSnapshotChecksum = hash(replacement);
      await collection.replaceOne({ _id: snapshot._id }, replacement, { upsert: true, maxTimeMS: 30000 });
      generated[name][String(snapshot._id)] = hash(await collection.findOne({ _id: snapshot._id }));
    };
    for (const decision of preview.decisions) {
      if (!['promote', 'graduate'].includes(decision.action)) continue;
      const { termId: _termId, __v, ...snapshot } = decision.student;
      snapshot.semesterLabel = decision.semesterLabel || snapshot.semesterLabel;
      snapshot.status = decision.action === 'graduate' ? 'graduated' : 'active';
      delete snapshot.semester; // Legacy numbered ref belongs to its original year.
      await saveSnapshot('Student', snapshot);
    }
    for (const cls of preview.classes) {
      const number = ROMAN.indexOf(cls.currentSemester);
      const duration = Number((target.programDurations instanceof Map ? target.programDurations.get(cls.department) : target.programDurations?.[cls.department]));
      if (cls.status !== 'active' || number < 1 || number >= duration) continue;
      const { termId: _termId, __v, ...snapshot } = cls;
      snapshot.currentSemester = ROMAN[number + 1];
      await saveSnapshot('ClassGroup', snapshot);
    }
    const preparation = { ...preview.summary, preparedAt: new Date(), sourceTermId: String(preview.source._id) };
    for (const [name, rows] of Object.entries(previous)) for (const id of Object.keys(rows)) if (!generated[name]?.[id]) { await keepLease(); await destination.models[name].collection.deleteOne({ _id: new mongoose.Types.ObjectId(id) }, { maxTimeMS: 30000 }); }
    await AcademicTermJob.updateOne({ key }, { $set: { status: 'completed', manifest: { ...preparation, generated } } });
    await AcademicTerm.updateOne({ _id: target._id, lifecycle: 'draft' }, { $set: { preparation, predecessor: preview.source._id } });
    return preparation;
  } finally { await releaseAcademicLease(lease); }
}

export async function publishAcademicTerm(target, expectedRevision, userId) {
  const existing = await AcademicPublication.findById('current').lean();
  if (String(existing?.currentTermId) === String(target._id)) return existing;
  if (target.lifecycle !== 'draft' || !target.preparation) throw termError('Prepare this draft semester before publishing.');
  if (!target.calendarUrl || !target.startDate || !target.endDate) throw termError('Configure semester dates and academic calendar before publishing.', 400);
  const { lease, state } = await acquireAcademicLease(expectedRevision);
  try {
    const preview = await buildPromotionPreview(target);
    const completed = await AcademicTermJob.findOne({ key: `prepare:${target._id}`, status: 'completed' }).lean();
    if (completed?.manifest?.sourceManifest !== preview.manifest) throw termError('Complete semester preparation before publishing.');
    if (preview.source.endDate && new Date(target.startDate) <= new Date(preview.source.endDate)) throw termError('New semester dates overlap the current semester.', 400);
    if (preview.manifest !== target.preparation.sourceManifest || preview.summary.errors.length) throw termError('Source data changed after preparation. Reconcile before publishing.');
    const result = await AcademicPublication.findOneAndUpdate({ _id: 'current', revision: state.revision, lease },
      { $set: { currentTermId: target._id, publishedBy: userId, publishedAt: new Date() }, $inc: { revision: 1 } }, { new: true }).lean();
    if (!result) throw termError('Publication changed. Reload and retry.');
    await AcademicTerm.updateOne({ _id: state.currentTermId }, { $set: { lifecycle: 'archived' } });
    await AcademicTerm.updateOne({ _id: target._id }, { $set: { lifecycle: 'current', 'preparation.publishedAt': new Date() } });
    await AcademicTermJob.updateOne({ key: `publish:${target._id}` }, { $set: { termId: target._id, sourceTermId: state.currentTermId, kind: 'publish', status: 'completed', manifest: { revision: result.revision } } }, { upsert: true });
    return result;
  } finally { await releaseAcademicLease(lease); }
}

export function validateTermConfiguration(body, existing = {}) {
  const value = { ...existing, ...body };
  const match = /^(\d{4})-(\d{4})$/.exec(value.academicYear || '');
  if (!match || Number(match[2]) !== Number(match[1]) + 1) throw termError('Academic year must be consecutive years, for example 2026-2027.', 400);
  if (!['odd', 'even'].includes(value.parity)) throw termError('Semester must be odd or even.', 400);
  if (value.calendarUrl) {
    let url; try { url = new URL(value.calendarUrl); } catch { throw termError('Calendar URL is invalid.', 400); }
    if (url.protocol !== 'https:') throw termError('Calendar URL must use HTTPS.', 400);
  }
  for (const field of ['startDate', 'endDate']) if (value[field] && Number.isNaN(new Date(value[field]).getTime())) throw termError('Invalid semester dates.', 400);
  if (value.startDate && value.endDate && new Date(value.startDate) > new Date(value.endDate)) throw termError('Semester end must follow its start.', 400);
  const durations = value.programDurations instanceof Map ? Object.fromEntries(value.programDurations) : value.programDurations || {};
  for (const [branch, count] of Object.entries(durations)) if (!branch || !Number.isInteger(count) || count < 1 || count > 12) throw termError('Program durations must be semester counts between 1 and 12.', 400);
  return { academicYear: value.academicYear, parity: value.parity, key: `${value.academicYear}-${value.parity}`,
    startDate: value.startDate || undefined, endDate: value.endDate || undefined, calendarUrl: value.calendarUrl || '', programDurations: durations };
}
