import express from 'express';
import mongoose from 'mongoose';
import AcademicTerm from '../models/AcademicTerm.js';
import AcademicPublication from '../models/AcademicPublication.js';
import { protect, authorizeExact } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { academicTermsEnabled } from '../utils/academicTermContext.js';
import { buildPromotionPreview, prepareAcademicTerm, publishAcademicTerm, validateTermConfiguration, termError } from '../services/academicTermService.js';

const router = express.Router();
const visibleTerm = term => {
  if (!term) return null;
  const { storageKey, routingRevision, __v, ...safe } = term;
  return safe;
};
router.get('/context', asyncHandler(async (req, res) => {
  if (!academicTermsEnabled()) return res.json({ enabled: false, currentTerm: null, terms: [], revision: 0 });
  const state = await AcademicPublication.findById('current').lean();
  const terms = await AcademicTerm.find(req.user?.role === 'admin' && !req.impersonator && !req.isDemo ? {} : { _id: state?.currentTermId }).sort({ academicYear: -1, parity: 1 }).lean();
  res.json({ enabled: true, revision: state?.revision || 0, currentTerm: visibleTerm(terms.find(term => String(term._id) === String(state?.currentTermId))), terms: terms.map(visibleTerm) });
}));
router.use(protect, authorizeExact('admin'));
router.post('/', asyncHandler(async (req, res) => {
  const config = validateTermConfiguration(req.body);
  const term = await AcademicTerm.create(config);
  res.status(201).json(visibleTerm(term.toObject()));
}));
router.param('id', async (req, res, next, id) => {
  try {
    if (!mongoose.isValidObjectId(id)) throw termError('Invalid academic semester ID.', 400);
    req.targetTerm = await AcademicTerm.findById(id);
    if (!req.targetTerm) throw termError('Semester not found.', 404);
    next();
  } catch (error) { next(error); }
});
router.patch('/:id', asyncHandler(async (req, res) => {
  if (req.targetTerm.lifecycle === 'archived') throw termError('Archived semesters are read only.', 403);
  if (req.targetTerm.lifecycle !== 'draft' && (req.body.academicYear || req.body.parity)) throw termError('Published semester identity cannot be changed.');
  const config = validateTermConfiguration(req.body, req.targetTerm.toObject({ flattenMaps: true }));
  if (req.targetTerm.preparation && (config.key !== req.targetTerm.key || JSON.stringify(config.programDurations) !== JSON.stringify(req.targetTerm.toObject({ flattenMaps: true }).programDurations))) throw termError('Program rules and semester identity are locked after preparation.');
  Object.assign(req.targetTerm, config);
  await req.targetTerm.save();
  res.json(visibleTerm(req.targetTerm.toObject()));
}));
router.get('/:id/preview', asyncHandler(async (req, res) => {
  const preview = await buildPromotionPreview(req.targetTerm);
  res.json({ ...preview.summary, sourceTerm: visibleTerm(preview.source), targetTerm: visibleTerm(req.targetTerm.toObject()) });
}));
router.post('/:id/prepare', asyncHandler(async (req, res) => {
  if (req.targetTerm.lifecycle !== 'draft') throw termError('Only draft semesters can be prepared.');
  res.json({ preparation: await prepareAcademicTerm(req.targetTerm, Number(req.body.expectedRevision), { reconcile: req.body.reconcile === true }) });
}));
router.post('/:id/publish', asyncHandler(async (req, res) => {
  const state = await publishAcademicTerm(req.targetTerm, Number(req.body.expectedRevision), req.user._id);
  res.json({ currentTermId: state.currentTermId, revision: state.revision });
}));
export default router;
