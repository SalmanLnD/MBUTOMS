import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowsLocalPunchTrial} from '../../utils/photoPunchNetworkPolicy.js';
test('network exception requires explicit development opt-in and direct localhost traffic', () => {
  const req = {socket:{remoteAddress:'127.0.0.1'},hostname:'localhost',headers:{}};
  const env = {PUNCH_LOCAL_TRIAL_ALLOW_UNVERIFIED_NETWORK:'true',NODE_ENV:'development'};
  assert.equal(allowsLocalPunchTrial(req,env),true);
  assert.equal(allowsLocalPunchTrial(req,{}),false);
  assert.equal(allowsLocalPunchTrial(req,{...env,NODE_ENV:'production'}),false);
  assert.equal(allowsLocalPunchTrial({...req,hostname:'example.com'},env),false);
  assert.equal(allowsLocalPunchTrial({...req,socket:{remoteAddress:'192.168.1.2'}},env),false);
  assert.equal(allowsLocalPunchTrial({...req,headers:{'x-forwarded-for':'1.2.3.4'}},env),false);
});
