import test from 'node:test';
import assert from 'node:assert/strict';
import TopicTrackerEntry from '../../models/TopicTrackerEntry.js';
import { getCancellationApprovals } from '../../controllers/topicTrackerController.js';
import { runWithAcademicTerm } from '../../utils/academicTermContext.js';

test('pending cancellation queue includes legacy entries without writing in a read-only semester', async () => {
  const previous = process.env.ACADEMIC_TERMS_ENABLED;
  process.env.ACADEMIC_TERMS_ENABLED = 'true';
  let filter;
  const entries = [{ _id: 'pending', cancellationApprovalStatus: 'pending' }, { _id: 'legacy', cancellationApprovalStatus: 'none' }];
  const chain = { populate: () => chain, sort: () => chain, limit: () => chain, lean: async () => entries };
  const model = {
    find(value) { filter = value; return chain; },
    updateMany() { throw new Error('Read-only queue attempted a write'); },
  };
  const res = { json(body) { this.body = body; } };
  try {
    await runWithAcademicTerm({ readOnly: true, repositories: { models: { TopicTrackerEntry: model } } }, () =>
      getCancellationApprovals({ user: { role: 'admin' }, query: { status: 'pending' } }, res));
    assert.deepEqual(res.body.entries, entries);
    assert.deepEqual(filter.$or, [
      { cancellationApprovalStatus: 'pending' },
      { cancellationApprovalStatus: 'none' },
      { cancellationApprovalStatus: { $exists: false } },
    ]);
  } finally {
    if (previous === undefined) delete process.env.ACADEMIC_TERMS_ENABLED;
    else process.env.ACADEMIC_TERMS_ENABLED = previous;
  }
});
