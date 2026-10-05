import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import AppSetting from '../../models/AppSetting.js';
import CompOff from '../../models/CompOff.js';
import FeedbackForm from '../../models/FeedbackForm.js';
import Trainer from '../../models/Trainer.js';
import ClassGroup from '../../models/ClassGroup.js';
import { listCompOffs, getCompOffSummary } from '../../controllers/compOffController.js';
import { getCurrentMonthForm, getPublicFeedbackForm } from '../../controllers/feedbackController.js';
import { protect, authorizeExact } from '../../middleware/auth.js';
import { guardDemoToken, maskDemoCredentials } from '../../utils/demoAccess.js';
import { getAiToolDeclarations, resolveAiTrainer } from '../../ai/aiTools.js';
import { getAppsScriptSetup } from '../../services/appsScriptSheetsService.js';
import { getAttendanceAppsScriptSetup } from '../../services/attendanceSheetsService.js';
import { getTopicTrackerAppsScriptSetup } from '../../services/topicTrackerSheetsService.js';
import { getFeedbackAppsScriptSetup } from '../../services/feedbackSheetsService.js';
import { getTestReportAppsScriptSetup } from '../../services/studentTestReportSheetsService.js';
import { getPlpAppsScriptSetup } from '../../services/plpSheetsService.js';

test('demo has admin reads and AI tools, but all business write verbs are blocked before controllers', async t => {
  const secret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'demo-test-secret';
  t.after(() => { secret === undefined ? delete process.env.JWT_SECRET : process.env.JWT_SECRET = secret; });
  const account = { _id: 'demo-owner', role: 'demo', isActive: true, sessionVersion: 1 };
  t.mock.method(User, 'findById', () => ({ select: async () => account }));
  let writes = 0;
  const app = express(); app.use(guardDemoToken);
  app.get('/api/read', protect, authorizeExact('admin'), async (req, res) => {
    assert.equal(req.isDemo, true); assert.equal(req.user.role, 'admin'); assert.equal(account.role, 'demo');
    assert.deepEqual(getAiToolDeclarations(req), getAiToolDeclarations({ user: { role: 'admin' } }));
    const trainer = await resolveAiTrainer(req, { trainerName: 'Test' }, { findTrainers: async () => [{ _id: 'other', name: 'Test' }] });
    assert.equal(trainer.name, 'Test'); res.json({ role: req.user.role });
  });
  for (const method of ['post','put','patch','delete']) app[method]('/api/write', protect, (req,res) => { writes++; res.json({}); });
  app.post('/api/ai/chat', protect, (req,res) => res.json({ role: req.user.role }));
  app.post('/api/public-write', (req,res) => { writes++; res.json({}); });
  app.get('/api/webhooks/whatsapp-sync/claim', (req,res) => { writes++; res.json({}); });
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ id: account._id, sv: 1, av: '2.2.1', demo: true }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };
  assert.equal((await fetch(url+'/api/read', { headers })).status, 200);
  for (const method of ['POST','PUT','PATCH','DELETE']) {
    const response = await fetch(url+'/api/write', { headers, method });
    assert.equal(response.status, 403); assert.equal((await response.json()).code, 'DEMO_READ_ONLY');
  }
  assert.equal((await fetch(url+'/api/public-write', { headers, method: 'POST' })).status, 403);
  assert.equal((await fetch(url+'/api/webhooks/whatsapp-sync/claim', { headers })).status, 403);
  assert.equal((await fetch(url+'/api/ai/chat', { headers, method: 'POST' })).status, 200);
  // A forged client role or omitted demo claim cannot grant a demo account writes.
  const oldToken = jwt.sign({ id: account._id, sv: 1, av: '2.2.1', role: 'admin' }, process.env.JWT_SECRET);
  assert.equal((await fetch(url+'/api/write', { headers: { Authorization: `Bearer ${oldToken}` }, method: 'PUT' })).status, 403);
  assert.equal(writes, 0);
});

test('demo trainer preview remains restricted and validates the owning demo session', async t => {
  const old = process.env.JWT_SECRET; process.env.JWT_SECRET = 'demo-preview-test';
  t.after(() => { old === undefined ? delete process.env.JWT_SECRET : process.env.JWT_SECRET = old; });
  const owner = { _id: 'owner', role: 'demo', isActive: true, sessionVersion: 1 };
  const target = { _id: 'target', role: 'trainer', isActive: true, sessionVersion: 1 };
  t.mock.method(User, 'findById', id => ({ select: async () => id === 'owner' ? owner : target }));
  const app=express(); app.all('/api/preview', protect, (req,res) => res.json({ demo: req.isDemo, role: req.user.role }));
  const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
  t.after(()=>{server.closeAllConnections();server.close()});
  const request = async method => fetch(`http://127.0.0.1:${server.address().port}/api/preview`, { method, headers: { Authorization: `Bearer ${jwt.sign({ id:'target',sv:1,av:'2.2.1',demo:true,impersonatedBy:'owner',demoOwner:'owner',demoSv:1 },process.env.JWT_SECRET)}` } });
  assert.deepEqual(await (await request('GET')).json(),{demo:true,role:'trainer'});
  assert.equal((await request('PUT')).status,403); owner.sessionVersion=2;
  assert.equal((await request('GET')).status,401);
});

test('every demo sheet setup uses an inert key without creating or revealing database keys', async t => {
  t.mock.method(AppSetting,'findOne',()=>{throw Error('Demo setup must not look up a real key')});
  t.mock.method(AppSetting,'findOneAndUpdate',()=>{throw Error('Demo setup must not write')});
  const req={isDemo:true,headers:{},protocol:'https',get:()=> 'example.invalid'};
  for (const setup of [getAppsScriptSetup,getAttendanceAppsScriptSetup,getTopicTrackerAppsScriptSetup,getFeedbackAppsScriptSetup,getTestReportAppsScriptSetup,getPlpAppsScriptSetup]) {
    const data=await setup(req); assert.equal(data.apiKey,'DEMO_LOCAL_ONLY'); assert.ok(data.script.includes('DEMO_LOCAL_ONLY'));
  }
});

test('demo API masking removes the hidden credential halves without changing records or identifiers',()=>{
  const record={_id:'trainer-id',name:'Salman',camuErpId:'adjfaculty-cdc086',camuPassword:'12345678'};
  const response=maskDemoCredentials({trainers:[record]});
  assert.equal(response.trainers[0].camuErpId,'adjfacultxxxxxxxx');
  assert.equal(response.trainers[0].camuPassword,'1234xxxx');
  assert.equal(response.trainers[0]._id,record._id);
  assert.equal(record.camuPassword,'12345678');
});

test('demo page reads do not seed comp-offs or persist feedback field backfills', async t => {
  const query = { select() { return this; }, populate() { return this; }, sort() { return this; }, lean: async () => [] };
  t.mock.method(CompOff, 'estimatedDocumentCount', () => { throw Error('Demo reads must not seed'); });
  t.mock.method(CompOff, 'insertMany', () => { throw Error('Demo reads must not insert'); });
  t.mock.method(CompOff, 'find', () => query);
  let response;
  const res = { json: data => { response = data; } };
  const req = { isDemo: true, user: { role: 'admin' }, query: {}, params: {} };
  await listCompOffs(req, res); assert.deepEqual(response.rows, []);
  await getCompOffSummary({ ...req, query: { employeeId: 'demo' } }, res);
  assert.equal(response.summary.totalRecords, 0);
  const form = () => ({ monthKey: '2026-10', fields: [], save() { throw Error('Demo reads must not backfill'); } });
  t.mock.method(FeedbackForm, 'findOne', async () => form());
  t.mock.method(User, 'find', () => query);
  t.mock.method(Trainer, 'find', () => query);
  t.mock.method(ClassGroup, 'find', () => query);
  await getCurrentMonthForm(req, res); assert.ok(response.form.fields.length > 0);
  // Public pages use the global verified-token flag instead of protect().
  await getPublicFeedbackForm({ hasDemoToken: true, params: { slug: 'demo' } }, res);
  assert.ok(response.fields.length > 0);
});
