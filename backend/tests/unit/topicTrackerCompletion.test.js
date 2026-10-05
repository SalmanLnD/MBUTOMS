import test from 'node:test';
import assert from 'node:assert/strict';
import { addCompletedTopicHistory, collectCompletedTopicsForSessions } from '../../utils/topicTrackerSessions.js';
import TopicTrackerEntry from '../../models/TopicTrackerEntry.js';

const day = '2026-10-05';
const session = { subjectId: 'subject-one', branchYearSection: 'CSE, PY 2023 Sem V - A1' };
const entry = { subject: 'subject-one', branchYearSection: 'CSE, Sem V - A1', date: '2026-10-01', trackerStatus: 'closed', sessionStatus: 'completed', topicModulesCovered: ['Arrays'] };

test('completion follows the subject and class across dates/trainers, and preserves full legacy titles', () => {
  const rows = collectCompletedTopicsForSessions([session], [entry,
    { ...entry, trainer: 'replacement', branchYearSection: "CSE, Sem V - A1'-CC", topicModulesCovered: ['Arrays', 'Trees'] },
    { ...entry, topicModulesCovered: [], topicModuleCovered: 'Lists, tuples and dictionaries' },
  ], day);
  assert.deepEqual(rows[0].completedTopics, ['Arrays', 'Trees', 'Lists, tuples and dictionaries']);
});
test('other classes, subjects, known cohorts, future days and incomplete/cancelled lessons stay unhighlighted', () => {
  const unrelated = [
    { ...entry, subject: 'subject-two' }, { ...entry, branchYearSection: 'CSE, Sem V - A2' },
    { ...entry, branchYearSection: 'CSE, PY 2024 Sem V - A1' },
    { ...entry, date: '2026-10-06' }, { ...entry, trackerStatus: 'pending' },
    { ...entry, sessionStatus: 'cancelled' }, { ...entry, sessionStatus: 'postponed' },
  ];
  assert.deepEqual(collectCompletedTopicsForSessions([session], unrelated, day)[0].completedTopics, []);
  const rows = collectCompletedTopicsForSessions([session, { ...session, subjectId: 'subject-two' }], [entry], day);
  assert.deepEqual(rows.map(row => row.completedTopics), [['Arrays'], []]);
});
test('history is loaded once for the authorized session subjects and skips empty results', async t => {
  const filters = [];
  t.mock.method(TopicTrackerEntry, 'find', filter => {
    filters.push(filter);
    return { select() { return this; }, lean: async () => [entry] };
  });
  assert.deepEqual(await addCompletedTopicHistory([], day), []);
  const rows = await addCompletedTopicHistory([session, session], day);
  assert.equal(filters.length, 1);
  assert.deepEqual(filters[0].subject, { $in: ['subject-one'] });
  assert.equal(filters[0].sessionStatus, 'completed');
  assert.equal(filters[0].trackerStatus, 'closed');
  assert.deepEqual(rows[1].completedTopics, ['Arrays']);
});
