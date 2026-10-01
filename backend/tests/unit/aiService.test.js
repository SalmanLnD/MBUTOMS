import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatWithAi, AiUnavailableError, MAX_TOOL_ROUNDS, MAX_TOOL_CALLS } from '../../ai/aiService.js';
import { getAiToolDeclarations, executeAiTool, resolveAiTrainer, validateToolArguments } from '../../ai/aiTools.js';
import { buildAiPrompt } from '../../ai/aiPrompt.js';

const req = { user: { _id: 'user', role: 'trainer', trainer: 'own', password: 'private-password', camuPassword: 'camu-secret' } };
const response = (parts) => ({ candidates: [{ content: { role: 'model', parts } }] });
const clientFor = (generateContent) => ({ models: { generateContent } });
const timetableDeps = {
  findTrainers: async () => [{ _id: 'own', name: 'Own Trainer', employeeId: '123456', password: 'private-password' }],
  subjectNames: new Map(), venueNames: new Map(), trainerNames: new Map(),
  computeHours: async () => new Map([['own|2026-10-01', { totalHours: 2.5, schedules: [], excludedSchedules: [] }]]),
};

test('IST defaults, strict arguments and bounded ranges reject injection', () => {
  assert.equal(validateToolArguments('get_my_timetable', {}, new Date('2026-09-30T20:00:00Z')).date, '2026-10-01');
  for (const args of [{ date: '2026-02-30' }, { trainerId: 'other' }, { date: { $gte: '' } }]) {
    assert.throws(() => validateToolArguments('get_my_timetable', args));
  }
  assert.throws(() => validateToolArguments('get_leaves', { from: '2026-09-01', to: '2026-10-31' }));
  assert.throws(() => validateToolArguments('get_live_venues', { time: '25:60' }));
});

test('trainer tools hide management operations and reject private attendance selectors', async () => {
  const names = getAiToolDeclarations(req).map((t) => t.name);
  assert.ok(!names.includes('get_trainer_timetable'));
  assert.ok(!names.includes('get_special_classes'));
  assert.ok(!names.includes('get_replacements'));
  assert.equal((await executeAiTool('get_trainer_timetable', { employeeId: '999999' }, req)).error, 'forbidden');
  assert.equal((await executeAiTool('get_trainer_hours', { employeeId: '999999' }, req)).error, 'forbidden');
  assert.equal((await executeAiTool('get_my_attendance', { trainerId: 'other' }, req)).error, 'invalid_arguments');
  assert.equal((await executeAiTool('get_my_attendance', { employeeId: 'other' }, req)).error, 'invalid_arguments');
  assert.equal((await executeAiTool('run_mongo_query', {}, req)).error, 'forbidden');
});

test('unlinked trainer cannot retrieve leaves, topics, classes or attendance', async () => {
  const unlinked = { user: { role: 'trainer' } };
  for (const [name, args] of [['get_leaves', {}], ['get_topic_tracker', {}], ['get_class_student_count', { department: 'CSE', section: 'A1', semester: 'III' }]]) {
    assert.equal((await executeAiTool(name, args, unlinked)).error, 'forbidden');
  }
  assert.equal((await executeAiTool('get_my_attendance', {}, unlinked)).error, 'not_found');
});

test('management reads permitted timetable; minimal projection excludes trainer secrets', async () => {
  const result = await executeAiTool('get_trainer_timetable', { employeeId: '123456', date: '2026-10-01' }, { user: { role: 'admin' } }, timetableDeps);
  assert.equal(result.totalHours, 2.5);
  assert.equal(result.trainer.name, 'Own Trainer');
  assert.ok(!JSON.stringify(result).includes('private-password'));
});

test('unknown and ambiguous trainers are never guessed', async () => {
  const admin = { user: { role: 'admin' } };
  assert.equal((await resolveAiTrainer(admin, { trainerName: 'Nobody' }, { findTrainers: async () => [] })).error, 'not_found');
  const ambiguous = await resolveAiTrainer(admin, { trainerName: 'Priya' }, {
    findTrainers: async () => [{ _id: 'a', name: 'Priya A', employeeId: '1' }, { _id: 'b', name: 'Priya B', employeeId: '2' }],
  });
  assert.equal(ambiguous.error, 'ambiguous');
  assert.equal(ambiguous.candidates.length, 2);
});

test('coordinator resolution enforces existing trainer scope; impersonation removes management tools', async () => {
  const coordinator = { user: { role: 'subject_coordinator', trainer: 'own' } };
  const deps = { findTrainers: async () => [{ _id: 'other', name: 'Other' }], canAccessTrainer: async () => false };
  assert.equal((await resolveAiTrainer(coordinator, { trainerName: 'Other' }, deps)).error, 'not_found');
  const impersonated = { ...req, impersonator: { role: 'admin' } };
  assert.equal((await executeAiTool('get_trainer_hours', { trainerName: 'Other' }, impersonated)).error, 'forbidden');
});

test('my attendance scopes even management to linked trainer and strips WhatsApp details', async () => {
  const result = await executeAiTool('get_my_attendance', { from: '2026-10-01', to: '2026-10-01' }, { user: { _id: 'admin', role: 'admin', trainer: 'own' } }, {
    attendanceGrid: async ({ user }) => {
      assert.equal(user.role, 'trainer'); assert.equal(user.trainer, 'own');
      return { rows: [{ trainer: { _id: 'own' }, days: { '2026-10-01': { attendanceType: 'OIF', classHandlingHours: 2 } } },
        { trainer: { _id: 'other' }, days: { '2026-10-01': { classHandlingHours: 9 } } }] };
    },
    read: async (controller, ownReq) => {
      assert.equal(ownReq.user.trainer, 'own');
      return { logs: [{ date: '2026-10-01', punchInAt: '2026-10-01T03:30:00Z', punchInSource: 'whatsapp', punchInRawPhone: 'sensitive-phone', punchInImageUrl: 'private-photo', whatsappMessageIds: ['private-payload'] }], pagination: { total: 1 } };
    },
  });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].classHandlingHours, 2);
  assert.equal(result.punches[0].source, 'whatsapp');
  assert.ok(!JSON.stringify(result).includes('sensitive-phone'));
  assert.ok(!JSON.stringify(result).includes('private-photo'));
  assert.ok(!JSON.stringify(result).includes('private-payload'));
});

test('unknown authorized class returns no record and class counts contain no students', async () => {
  const args = { department: 'CSE', section: 'A1', semester: 'III' };
  const missing = await executeAiTool('get_class_student_count', args, req, { read: async () => [] });
  assert.equal(missing.error, 'not_found');
  const result = await executeAiTool('get_class_student_count', args, req, { read: async () => [{ department: 'CSE', section: 'A1', currentSemester: 'III', studentCount: 56, students: ['secret-student'] }] });
  assert.equal(result.activeStudentCount, 56);
  assert.ok(!JSON.stringify(result).includes('secret-student'));
});

test('function calling preserves signatures and emits only final answer, never thoughts or key', async () => {
  const requests = [];
  const env = { GEMINI_API_KEY: 'secret-test-key', JWT_SECRET: 'secret-jwt-value' };
  const result = await chatWithAi({ message: 'My hours today?', req }, {
    env, now: new Date('2026-10-01T03:30:00Z'),
    client: clientFor(async (input) => {
      requests.push(structuredClone(input.contents));
      if (requests.length === 1) return response([{ functionCall: { name: 'get_trainer_hours', args: {}, id: 'call-1' }, thoughtSignature: 'opaque-signature' }]);
      return response([{ thought: true, text: 'hidden reasoning' }, { text: '2.5 hours. secret-test-key' }]);
    }),
    executeTool: async (name, args, context) => {
      assert.equal(context, req);
      return { totalHours: 2.5 };
    },
  });
  assert.equal(result.message, '2.5 hours. [redacted]');
  assert.equal(requests[1][1].parts[0].thoughtSignature, 'opaque-signature');
  assert.equal(requests[1][2].parts[0].functionResponse.id, 'call-1');
  assert.ok(!JSON.stringify(result).includes('hidden reasoning'));
  assert.ok(!buildAiPrompt(req.user).includes('camu-secret'));
  assert.ok(!buildAiPrompt(req.user).includes('private-password'));
});

test('bounded loop runs at most three tool rounds and eight tools', async () => {
  let generations = 0; let executions = 0;
  const result = await chatWithAi({ message: 'My timetable', req }, {
    client: clientFor(async () => { generations++; return response([{ functionCall: { name: 'get_my_timetable', args: {} } }]); }),
    executeTool: async () => { executions++; return { schedules: [] }; },
  });
  assert.equal(executions, MAX_TOOL_ROUNDS);
  assert.equal(generations, MAX_TOOL_ROUNDS + 1);
  assert.match(result.message, /lookup limit/);
  executions = 0;
  await chatWithAi({ message: 'Many questions', req }, {
    client: clientFor(async () => response(Array.from({ length: 4 }, () => ({ functionCall: { name: 'get_my_timetable', args: {} } })))),
    executeTool: async () => { executions++; return {}; },
  });
  assert.equal(executions, MAX_TOOL_CALLS);
});

test('provider errors, empty responses and missing key return a clean unavailable error', async () => {
  for (const deps of [{ env: {} }, { client: clientFor(async () => { throw new Error('secret-key internal stack'); }) }, { client: clientFor(async () => response([])) }]) {
    await assert.rejects(chatWithAi({ message: 'Hello', req }, deps), (error) => error instanceof AiUnavailableError && !error.message.includes('secret-key'));
  }
});

test('failed live tool sends sanitized error to model without internal exception', async () => {
  let count = 0;
  await chatWithAi({ message: 'My hours', req }, {
    client: clientFor(async ({ contents }) => {
      if (++count === 1) return response([{ functionCall: { name: 'get_trainer_hours', args: {} } }]);
      const result = contents[2].parts[0].functionResponse.response;
      assert.equal(result.error, 'unavailable');
      assert.ok(!JSON.stringify(result).includes('private-stack'));
      return response([{ text: 'I could not retrieve your live hours.' }]);
    }),
    executeTool: async () => { throw new Error('private-stack'); },
  });
});
