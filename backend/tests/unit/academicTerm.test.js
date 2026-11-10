import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { nextTermKey, promotionDecision, validateTermConfiguration } from '../../services/academicTermService.js';
import { runWithAcademicTerm, getAcademicTermContext, termCollectionName, termModel } from '../../utils/academicTermContext.js';

test('academic year/term progression distinguishes cohort semester', () => {
  assert.equal(nextTermKey({ academicYear: '2026-2027', parity: 'odd' }), '2026-2027-even');
  assert.equal(nextTermKey({ academicYear: '2026-2027', parity: 'even' }), '2027-2028-odd');
  const student = { rollNumber: 'A', status: 'active', branch: 'BCA', semesterLabel: 'III' };
  const target = { programDurations: { BCA: 6 } };
  assert.deepEqual(promotionDecision(student, { parity: 'odd' }, target), { action: 'promote', semesterLabel: 'IV' });
  assert.equal(student.semesterLabel, 'III');
  assert.deepEqual(promotionDecision({ ...student, semesterLabel: 'VI' }, { parity: 'even' }, target), { action: 'graduate' });
  assert.equal(promotionDecision(student, { parity: 'odd' }, {}).action, 'error');
  assert.equal(promotionDecision(student, { parity: 'even' }, target).action, 'error');
  assert.equal(promotionDecision({ ...student, status: 'inactive' }, { parity: 'odd' }, target).action, 'skip');
});

test('configuration rejects unsafe calendar, invalid dates and ambiguous rules', () => {
  assert.throws(() => validateTermConfiguration({ academicYear: '2026-2028', parity: 'odd' }));
  assert.throws(() => validateTermConfiguration({ academicYear: '2026-2027', parity: 'odd', calendarUrl: 'javascript:alert(1)' }));
  assert.throws(() => validateTermConfiguration({ academicYear: '2026-2027', parity: 'odd', programDurations: { MCA: 0 } }));
  assert.equal(validateTermConfiguration({ academicYear: '2026-2027', parity: 'even' }).key, '2026-2027-even');
});

test('concurrent academic contexts cannot exchange selected repositories', async () => {
  await Promise.all(['odd', 'even'].map(async key => runWithAcademicTerm({ term: { key } }, async () => {
    await new Promise(resolve => setTimeout(resolve, key === 'odd' ? 10 : 1));
    assert.equal(getAcademicTermContext().term.key, key);
  })));
  assert.equal(getAcademicTermContext(), undefined);
  assert.throws(() => termCollectionName('bad-id', 'students'));
});

test('term model facade resolves each request and fails closed without context', () => {
  const old = process.env.ACADEMIC_TERMS_ENABLED;
  const model = termModel('TermFacadeTest', new mongoose.Schema({ name: String }));
  process.env.ACADEMIC_TERMS_ENABLED = 'true';
  try {
    assert.throws(() => model.find(), /context required/);
    const one = { find: () => 'one' }, two = { find: () => 'two' };
    assert.equal(runWithAcademicTerm({ repositories: { models: { TermFacadeTest: one } } }, () => model.find()), 'one');
    assert.equal(runWithAcademicTerm({ repositories: { models: { TermFacadeTest: two } } }, () => model.find()), 'two');
  } finally {
    if (old === undefined) delete process.env.ACADEMIC_TERMS_ENABLED; else process.env.ACADEMIC_TERMS_ENABLED = old;
  }
});
