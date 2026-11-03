import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../../models/User.js';
import Trainer from '../../models/Trainer.js';
import Notification from '../../models/Notification.js';
import { notifyAdminOfPunch, formatPunchNotificationTime } from '../../utils/punchNotifications.js';
import { attachManagerEditNotifier } from '../../utils/managerEditNotifications.js';

test('successful punch notification uses trainer name and exact IST time for administrators', async t => {
  let sent; t.mock.method(User,'find',() => ({select:()=>({lean:async()=>[{_id:'admin'}]})}));
  t.mock.method(Trainer,'findById',() => ({select:()=>({lean:async()=>({name:'Trainer Name'})})}));
  t.mock.method(Notification,'insertMany',async docs=>{sent=docs;});
  await notifyAdminOfPunch({user:{_id:'user',trainer:'trainer',name:'Account',role:'trainer'},capturedAt:'2026-11-03T03:12:34Z'});
  assert.equal(sent[0].message,'Trainer Name punched in at 08:42:34');
  assert.equal(sent[0].recipient,'admin');
  assert.equal(formatPunchNotificationTime('2026-11-02T18:30:05Z'),'00:00:05');
});
test('photo capture and submit do not generate generic record notifications',()=>{
  for(const path of ['/api/photo-punch/capture-session','/api/photo-punch/submit']) {
    const res={locals:{},json() {}};attachManagerEditNotifier({user:{role:'manager'},method:'POST',originalUrl:path},res);
    assert.equal(res.locals.managerEditNotifierAttached,undefined);
  }
});
