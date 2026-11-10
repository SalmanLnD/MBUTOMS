import mongoose from 'mongoose';
import AcademicTerm from '../models/AcademicTerm.js';
import { academicTermsEnabled, getAcademicTermContext, getTermRepositories } from './academicTermContext.js';

const parentPaths = paths => Object.keys(paths);

// Shared operational rows retain their teaching provenance. A normal populate
// of a shared model would otherwise resolve Schedule against the legacy/current
// store and lose references as soon as a new semester is published.
export const sharedAcademicReferences = (schema, paths) => {
  schema.add({ termId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicTerm', immutable: true } });
  schema.pre('validate', function () {
    if (this.isNew && !this.termId && academicTermsEnabled()) {
      const termId = getAcademicTermContext()?.term?._id;
      if (termId) this.termId = termId;
    }
  });
  schema.pre(['find', 'findOne'], function () {
    if (!academicTermsEnabled()) return;
    const populate = this._mongooseOptions.populate;
    if (!populate) return;
    const saved = {};
    for (const path of parentPaths(paths)) {
      if (populate[path]) {
        saved[path] = { ...populate[path] };
        delete populate[path];
      }
    }
    if (!Object.keys(saved).length) return;
    this._academicPopulate = saved;
    // Include provenance when callers use an inclusive projection.
    const fields = this.projection();
    if (fields && Object.values(fields).some(value => value === 1 || value === true)) this.select('termId');
  });
  schema.post(['find', 'findOne'], async function (result) {
    if (!this._academicPopulate || !result) return;
    const rows = Array.isArray(result) ? result : [result];
    const groups = new Map();
    for (const row of rows) {
      const key = row.termId ? String(row.termId) : 'legacy';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    for (const [termId, docs] of groups) {
      let models = mongoose.models;
      if (termId !== 'legacy') {
        const term = await AcademicTerm.findById(termId).lean();
        if (!term) throw new Error('Operational record references an unknown academic semester');
        models = (await getTermRepositories(term)).models;
      }
      for (const [path, options] of Object.entries(this._academicPopulate)) {
        await this.model.populate(docs, { ...options, model: models[paths[path]] });
      }
    }
  });
};
