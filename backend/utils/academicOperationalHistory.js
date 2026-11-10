import AcademicTerm from '../models/AcademicTerm.js';
import AcademicPublication from '../models/AcademicPublication.js';
import { academicTermsEnabled, getAcademicTermContext, getTermRepositories, runWithAcademicTerm } from './academicTermContext.js';

const dayKey = value => new Date(value).toISOString().slice(0, 10);

// Operational reports span semesters. Resolve the teaching source by occurrence
// date rather than the admin's private selection or today's published semester.
export const groupOperationalDatesByTerm = (dates, terms) => {
  const groups = new Map();
  for (const date of dates) {
    const key = dayKey(date);
    const candidates = terms.filter(term => term.startDate && term.endDate
      && dayKey(term.startDate) <= key && dayKey(term.endDate) >= key);
    if (candidates.length > 1) throw new Error(`Academic semester dates overlap on ${key}`);
    const term = candidates[0] || null;
    const id = term ? String(term._id) : 'legacy';
    if (!groups.has(id)) groups.set(id, { term, dates: [] });
    groups.get(id).dates.push(date);
  }
  return [...groups.values()];
};

export const getOperationalTerms = async () => {
  const state = await AcademicPublication.findById('current').lean();
  if (!state) throw new Error('Academic migration is required');
  return AcademicTerm.find({ $or: [{ _id: state.currentTermId }, { lifecycle: 'archived' }] }).lean();
};

export const runOperationalTerm = async (term, callback) => {
  const context = getAcademicTermContext() || {};
  const repositories = term ? await getTermRepositories(term) : undefined;
  return runWithAcademicTerm({ ...context, term, repositories, maintenance: !term, operationalDate: true }, callback);
};

export const needsOperationalTermResolution = () => academicTermsEnabled() && !getAcademicTermContext()?.operationalDate;

export const runForOperationalDate = async (date, callback) => {
  if (!needsOperationalTermResolution()) return callback();
  const [group] = groupOperationalDatesByTerm([date], await getOperationalTerms());
  return runOperationalTerm(group.term, callback);
};
