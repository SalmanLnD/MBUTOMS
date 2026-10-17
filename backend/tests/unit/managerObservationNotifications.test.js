import { test } from 'node:test';
import assert from 'node:assert/strict';
import Notification from '../../models/Notification.js';
import User from '../../models/User.js';
import { createManagerEditNotifications } from '../../utils/managerEditNotifications.js';

test('observation edits identify type, trainer, month and link admins to the exact row', async t => {
  const sent = [];
  t.mock.method(User, 'find', () => ({ select: () => ({ lean: async () => [{ _id: 'admin' }] }) }));
  t.mock.method(Notification, 'insertMany', async docs => sent.push(...docs));
  for (const role of ['manager', 'campus_manager', 'subject_coordinator', 'evaluator']) {
    for (const type of ['demo', 'class']) {
      const req = { method: 'PUT', originalUrl: '/api/observations/trainer-1',
        user: { _id: 'navya', name: 'Navya', role }, body: { type, monthKey: '2026-09' } };
      await createManagerEditNotifications(req, { trainerId: 'trainer-1', name: 'Alice', employeeId: '123', updatedAt: 'now' });
      const doc = sent.at(-1);
      assert.equal(doc.recipient, 'admin');
      assert.equal(doc.resource, `${type} observation`);
      assert.match(doc.message, new RegExp(`Navya updated ${type} observation for Alice · 123 \\(2026-09\\)`));
      assert.equal(doc.entityPath, `/performance?tab=observations&type=${type}&month=2026-09&trainer=trainer-1`);
    }
  }
  assert.equal(sent.length, 8);
  const req = { method: 'PUT', originalUrl: '/api/observations/trainer-1', user: { _id: 'navya', name: 'Navya', role: 'manager' }, body: { type: 'demo', monthKey: '2026-09' } };
  await createManagerEditNotifications(req, { trainerId: 'trainer-1', name: 'Alice', updatedAt: null });
  assert.match(sent.at(-1).message, /Navya cleared demo observation/);
  for (const override of [{ impersonator: { _id: 'admin' } }, { user: { role: 'demo' } }, { method: 'GET' }]) {
    await createManagerEditNotifications({ ...req, ...override }, { trainerId: 'trainer-1' });
  }
  await createManagerEditNotifications({ ...req, originalUrl: '/api/trainers/trainer-1', user: { role: 'evaluator' } }, {});
  assert.equal(sent.length, 9);
});
