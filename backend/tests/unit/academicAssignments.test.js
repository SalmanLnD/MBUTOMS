import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateAcademicUser, projectTrainerAcademicSubjects } from '../../utils/academicAssignments.js';
import { runWithAcademicTerm } from '../../utils/academicTermContext.js';

test('term assignments project shared trainer without exposing old term subjects', async (t) => {
  const previous = process.env.ACADEMIC_TERMS_ENABLED;
  process.env.ACADEMIC_TERMS_ENABLED = 'true';
  t.after(() => { if (previous === undefined) delete process.env.ACADEMIC_TERMS_ENABLED; else process.env.ACADEMIC_TERMS_ENABLED = previous; });
  const subjectModel = { find: (filter) => {
    assert.deepEqual(filter, { trainerEligible: 'trainer' });
    return { select: () => ({ lean: async () => [{ _id: 'new-subject' }] }) };
  } };
  await runWithAcademicTerm({ repositories: { models: { Subject: subjectModel } } }, async () => {
    const trainer = { _id: 'trainer', subjects: ['old-subject'] };
    const result = await projectTrainerAcademicSubjects(trainer);
    assert.deepEqual(result.subjects, [{ _id: 'new-subject' }]);
    assert.deepEqual(trainer.subjects, ['old-subject']);
  });
});

test('term user hydration never falls back to shared permission arrays', async (t) => {
  const previous = process.env.ACADEMIC_TERMS_ENABLED;
  process.env.ACADEMIC_TERMS_ENABLED = 'true';
  t.after(() => { if (previous === undefined) delete process.env.ACADEMIC_TERMS_ENABLED; else process.env.ACADEMIC_TERMS_ENABLED = previous; });
  const assignmentModel = { findOne: () => ({ lean: async () => null }) };
  await runWithAcademicTerm({ repositories: { models: { AcademicUserAssignment: assignmentModel } } }, async () => {
    const user = { _id: 'user', coordinatorSubjects: ['old-subject'], evaluatorSubjects: ['old-subject'] };
    await hydrateAcademicUser(user);
    assert.deepEqual(user.coordinatorSubjects, []);
    assert.deepEqual(user.evaluatorSubjects, []);
  });
});
