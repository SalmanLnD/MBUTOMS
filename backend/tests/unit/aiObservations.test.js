import test from 'node:test';
import assert from 'node:assert/strict';
import { executeAiTool, getAiToolDeclarations, validateToolArguments } from '../../ai/aiTools.js';

const admin = { user: { role: 'admin' } };
const rows = [
  { monthKey: '2026-09', type: 'demo', observationDate: '2026-09-21', rating: 4 },
  { monthKey: '2026-10', type: 'demo', observationDate: '2026-10-20', rating: 4.5 },
  { monthKey: '2026-10', type: 'class', observationDate: '2026-10-21', rating: 3.5 },
  { monthKey: '2026-08', type: 'demo', rating: null },
  { monthKey: '2026-12', type: 'demo', observationDate: '2026-12-01', rating: 5 },
];
const deps = {
  now: new Date('2026-10-26T12:00:00Z'),
  findObservationTrainers: async () => [{ _id: 'roja', name: 'Karra Rojalakshmi', employeeId: '136407', password: 'secret' }],
  loadObservations: async (filter) => rows.filter((row) => !filter.type || row.type === filter.type),
};

test('observation tool respects access and blocks trainer and impersonation reads', async () => {
  for (const req of [{ user: { role: 'trainer' } }, { ...admin, impersonator: {} }]) {
    assert.ok(!getAiToolDeclarations(req).some((row) => row.name === 'get_observations'));
    assert.equal((await executeAiTool('get_observations', { trainerName: 'Roja' }, req, deps)).error, 'forbidden');
  }
});

test('record counts and 21–20 cycle ratings preserve undated history and exclude future records', async () => {
  const result = await executeAiTool('get_observations', { trainerName: 'Roja' }, admin, deps);
  assert.equal(result.demoCount, 3);
  assert.equal(result.classCount, 1);
  assert.equal(result.ratingScale, 5);
  const october = result.cycles.find((row) => row.cycle === '2026-10');
  assert.equal(october.from, '2026-09-21');
  assert.equal(october.to, '2026-10-20');
  assert.deepEqual(october.observations.map((row) => row.rating), [4, 4.5]);
  assert.ok(!JSON.stringify(result).includes('secret'));
  const filtered = await executeAiTool('get_observations', { employeeId: '136407', type: 'demo', cycle: '2026-10' }, admin, deps);
  assert.equal(filtered.demoCount, 2);
  assert.equal(filtered.classCount, 0);
  assert.equal(filtered.cycles.length, 1);
});

test('evaluators use the observation-specific trainer scope and do not disclose excluded trainers', async () => {
  const req = { user: { role: 'evaluator', evaluatorSubjects: ['subject'] } };
  let received;
  const result = await executeAiTool('get_observations', { trainerName: 'Roja' }, req, {
    ...deps, observationTrainerFilter: async () => ({ _id: { $in: ['allowed'] } }),
    findObservationTrainers: async (filter) => { received = filter; return []; },
    loadObservations: async () => { throw Error('Must not read excluded trainer'); },
  });
  assert.equal(result.error, 'not_found');
  assert.deepEqual(received.$and[1], { _id: { $in: ['allowed'] } });
  assert.throws(() => validateToolArguments('get_observations', { cycle: '2026-13' }));
  assert.throws(() => validateToolArguments('get_observations', { type: 'anything' }));
});
