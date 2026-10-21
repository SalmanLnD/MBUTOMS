import { test } from 'node:test';
import assert from 'node:assert/strict';
import TrainerDailyAttendance from '../../models/TrainerDailyAttendance.js';
import Trainer from '../../models/Trainer.js';
import User from '../../models/User.js';
import Notification from '../../models/Notification.js';
import { getLatePunchPhoto } from '../../controllers/latePunchController.js';
import { notifyReplacementAssignment } from '../../utils/replacementNotifications.js';

test('saved TOMS photo loads privately from Drive using the attendance date', async t => {
 const fields = ['PUNCH_GOOGLE_CLIENT_ID','PUNCH_GOOGLE_CLIENT_SECRET','PUNCH_GOOGLE_REFRESH_TOKEN'];
 const previous = fields.map(key=>process.env[key]);
 fields.forEach(key=>process.env[key]='synthetic');
 t.after(()=>fields.forEach((key,i)=>previous[i]===undefined?delete process.env[key]:process.env[key]=previous[i]));
 const record={date:new Date('2026-10-21T00:00:00Z'),punchInAt:new Date('2026-10-21T03:10:30Z'),punchInSource:'toms_camera',photoPunch:{driveFileId:'synthetic-file-id'}};
 t.mock.method(TrainerDailyAttendance,'findById',()=>({select:fields=>({lean:async()=>Object.fromEntries(fields.split(' ').map(key=>[key,record[key]]))})}));
 const requests=[];
 t.mock.method(globalThis,'fetch',async url=>{requests.push(url);return String(url).includes('oauth2')?{ok:true,json:async()=>({access_token:'synthetic-token'})}:{ok:true,arrayBuffer:async()=>new Uint8Array([255,216,255]).buffer};});
 const res={code:200,headers:{},status(code){this.code=code;return this;},json(body){this.body=body;},set(key,value){this.headers[key]=value;},send(body){this.body=body;}};
 await getLatePunchPhoto({params:{id:'attendance'}},res);
 assert.equal(res.code,200);assert.ok(Buffer.isBuffer(res.body));assert.equal(res.headers['Content-Type'],'image/jpeg');
 assert.match(res.headers['Cache-Control'],/private/);assert.match(requests[1],/synthetic-file-id\?alt=media/);
});

test('CAMU credentials reach only the new assigned trainer inbox, with a separate push preview', async t=>{
 const sent=[];
 t.mock.method(User,'find',()=>({select:()=>({lean:async()=>[{_id:'u-original',trainer:'original'},{_id:'u-new',trainer:'new'},{_id:'u-old',trainer:'old'}]})}));
 t.mock.method(Trainer,'findById',id=>{assert.equal(id,'original');return {select:()=>({lean:async()=>({camuErpId:'test-login',camuPassword:'test-password'})})};});
 t.mock.method(Notification,'insertMany',async docs=>sent.push(...docs));
 await notifyReplacementAssignment({actor:{_id:'admin',name:'Admin',role:'admin'},leave:{startDate:'2026-10-21',endDate:'2026-10-21'},schedule:{_id:'schedule',day:'Wednesday'},originalTrainer:{_id:'original',name:'Actual trainer'},replacementTrainer:{_id:'new',name:'Replacement'},previousReplacementTrainer:{_id:'old',name:'Previous'},affectedDateKeys:['2026-10-21']});
 assert.equal(sent.length,3);
 const replacement=sent.find(doc=>doc.recipient==='u-new');
 assert.match(replacement.message,/Login ID: test-login\nPassword: test-password/);
 for(const doc of sent.filter(doc=>doc.recipient!=='u-new')) assert.doesNotMatch(doc.message,/test-login|test-password/);
 assert.doesNotMatch(replacement.pushMessage,/test-login|test-password/);
});
