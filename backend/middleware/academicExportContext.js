import mongoose from 'mongoose';
import AcademicTerm from '../models/AcademicTerm.js';
import { academicTermsEnabled, getAcademicTermContext, getTermRepositories, runWithAcademicTerm } from '../utils/academicTermContext.js';

// A saved sheet remains bound to its original semester after publication.
// The supplied term only selects where its export key is validated; the caller
// must authenticate that key inside callback before sending any report data.
export const withAcademicExportContext = async (req, callback) => {
  if (!academicTermsEnabled() || !req.query.termId) return callback();
  if (!mongoose.isValidObjectId(req.query.termId)) {
    const error = new Error('Invalid semester export');
    error.statusCode = 400;
    throw error;
  }
  const term = await AcademicTerm.findById(req.query.termId).lean();
  if (!term) {
    const error = new Error('Semester export not found');
    error.statusCode = 404;
    throw error;
  }
  const repositories = await getTermRepositories(term);
  return runWithAcademicTerm({ ...getAcademicTermContext(), term, repositories, readOnly: true }, callback);
};
