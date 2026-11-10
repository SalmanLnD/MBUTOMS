import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose from 'mongoose';
import AcademicPublication from '../models/AcademicPublication.js';

const storage = new AsyncLocalStorage();
const definitions = new Map();
const stores = new Map();
export const academicTermsEnabled = () => process.env.ACADEMIC_TERMS_ENABLED === 'true';
export const getAcademicTermContext = () => storage.getStore();
export const runWithAcademicTerm = (context, callback) => storage.run(context, callback);

export const termCollectionName = (termId, collection) => {
  if (!mongoose.isValidObjectId(termId)) throw new Error('Invalid academic term ID');
  return `term_${String(termId)}_${collection}`;
};

// Models are bound to an immutable partition connection. No shared collection
// pointer is changed when two requests select different terms concurrently.
export async function getTermRepositories(term) {
  const id = String(term._id || term.termId);
  const alias = term.storageKey || 'shared';
  const cacheKey = `${id}:${alias}:${term.routingRevision || 0}`;
  if (!stores.has(cacheKey)) {
    const pending = (async () => {
      let connection;
      if (alias === 'shared') {
        connection = mongoose.connection.useDb(mongoose.connection.name, { useCache: false });
      } else {
        if (!/^[A-Z][A-Z0-9_]*$/.test(alias)) throw new Error('Invalid term storage alias');
        const uri = process.env[`ACADEMIC_DB_${alias}`];
        if (!uri) throw new Error(`Academic storage alias ${alias} is not configured`);
        connection = await mongoose.createConnection(uri).asPromise();
      }
      const models = {};
      for (const [name, definition] of definitions) {
        const schema = definition.schema.clone();
        schema.eachPath((_path, type) => {
          const options = type.caster?.options || type.options;
          if (typeof options?.ref === 'string' && !definitions.has(options.ref)) {
            // Shared references explicitly use the shared model, including when
            // this partition later moves to a different MongoDB URI.
            if (mongoose.models[options.ref]) options.ref = mongoose.models[options.ref];
          }
        });
        schema.add({ termId: { type: mongoose.Schema.Types.ObjectId, required: true, default: () => term._id || term.termId, immutable: true } });
        schema.pre('validate', function () {
          if (this.isNew) this.termId = term._id || term.termId;
        });
        schema.pre('insertMany', function (next, docs) {
          for (const doc of docs) doc.termId = term._id || term.termId;
          next();
        });
        const fence = async function () {
          const context = getAcademicTermContext();
          if (context?.maintenance) return;
          if (!context?.isWrite || !context.lease) throw Object.assign(new Error('Academic writes require a current publication lease.'), { statusCode: 409, code: 'ACADEMIC_TERM_STALE' });
          const valid = await AcademicPublication.exists({ _id: 'current', lease: context.lease, revision: context.revision,
            leaseExpiresAt: { $gt: new Date(Date.now() + 60000) } });
          if (!valid) throw Object.assign(new Error('Academic write expired. Reload before saving.'), { statusCode: 409, code: 'ACADEMIC_TERM_STALE' });
          if (typeof this.setOptions === 'function') this.setOptions({ maxTimeMS: 30000 });
        };
        schema.pre(['save', 'updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete'], fence);
        schema.pre('insertMany', fence);
        schema.pre('bulkWrite', fence);
        models[name] = connection.model(name, schema, termCollectionName(id, definition.collection));
      }
      return { termId: id, connection, models };
    })();
    stores.set(cacheKey, pending);
    pending.catch(() => stores.delete(cacheKey));
  }
  return stores.get(cacheKey);
}

export function termModel(name, schema, collection) {
  const legacy = mongoose.model(name, schema, collection);
  definitions.set(name, { schema, collection: legacy.collection.name });
  const resolve = () => {
    if (!academicTermsEnabled()) return legacy;
    const context = getAcademicTermContext();
    if (context?.maintenance === true) return legacy;
    const model = context?.repositories?.models?.[name];
    if (!model) throw new Error(`Academic term context required for ${name}`);
    return model;
  };
  return new Proxy(legacy, {
    get(_target, property) {
      // Schemas remain available to migration/tooling without selecting a term.
      if (property === 'schema') return schema;
      const model = resolve();
      const value = Reflect.get(model, property, model);
      return typeof value === 'function' && !value.modelName ? value.bind(model) : value;
    },
    construct(_target, args) { return Reflect.construct(resolve(), args); },
    apply(_target, thisArg, args) { return Reflect.apply(resolve(), thisArg, args); },
  });
}

export const getTermModelDefinitions = () => definitions;
