import AcademicTerm from '../models/AcademicTerm.js';
import AcademicPublication from '../models/AcademicPublication.js';
import { protect } from './auth.js';
import { getSessionToken } from '../utils/sessionCookie.js';
import { academicTermsEnabled, getTermRepositories, runWithAcademicTerm } from '../utils/academicTermContext.js';
import { acquireAcademicLease, releaseAcademicLease, termError } from '../services/academicTermService.js';
import { hydrateAcademicUser } from '../utils/academicAssignments.js';

const ACADEMIC_PATH = /^\/api\/(subjects|classes|students|schedules|topic-tracker|student-test-reports|sheets)(\/|$)/;
export const academicTermMiddleware = (req, res, next) => {
  if (!academicTermsEnabled()) return next();
  const resolve = async () => {
    const state = await AcademicPublication.findById('current').lean();
    if (!state) throw termError('Academic semesters are not migrated. Contact the administrator.', 503);
    let termId = state.currentTermId;
    const requested = req.headers['x-academic-term'];
    if (requested && ACADEMIC_PATH.test(req.path)) {
      if (req.user?.role !== 'admin' || req.impersonator || req.isDemo) {
        if (String(requested) !== String(state.currentTermId)) throw termError('Only administrators can select another semester.', 403);
      } else termId = requested;
    }
    const term = await AcademicTerm.findById(termId).lean();
    if (!term) throw termError('Academic semester not found.', 404);
    if (String(term._id) === String(state.currentTermId)) term.lifecycle = 'current';
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
      && (ACADEMIC_PATH.test(req.path) || /^\/api\/trainers(\/|$)/.test(req.path));
    let lease;
    if (isWrite) {
      if (String(term._id) !== String(state.currentTermId) && (term.lifecycle !== 'draft' || term.preparation?.publishedAt)) throw termError('Archived semesters are read only.', 403);
      if (ACADEMIC_PATH.test(req.path) && Number(req.headers['x-academic-revision']) !== state.revision) throw Object.assign(termError('The published semester changed. Reload before saving.'), { code: 'ACADEMIC_TERM_STALE' });
      ({ lease } = await acquireAcademicLease(state.revision, { waitMs: 10000 }));
      const release = () => { releaseAcademicLease(lease).catch(error => console.error('Academic write lease release failed', error.message)); };
      res.once('finish', release);
    }
    const repositories = await getTermRepositories(term);
    const context = { term, repositories, revision: state.revision, currentTermId: state.currentTermId, lease, isWrite };
    req.academicTerm = context;
    res.set('X-Academic-Term', String(term._id));
    res.set('X-Academic-Revision', String(state.revision));
    runWithAcademicTerm(context, () => {
      Promise.resolve(req.user ? hydrateAcademicUser(req.user) : undefined).then(() => next(), next);
    });
  };
  const proceed = () => { resolve().catch(next); };
  // Validate optional sessions before allowing private academic selection.
  if (getSessionToken(req) && !req.user && !req.path.startsWith('/api/auth/')) return protect(req, res, proceed);
  return proceed();
};
