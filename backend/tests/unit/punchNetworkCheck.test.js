import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPunchNetworkCheck} from '../../services/punchNetworkCheck.js';

test('proxycheck v3 classifies and briefly caches verified results', async () => {
  let calls = 0, time = 0;
  const check = createPunchNetworkCheck({env:{PUNCH_PROXYCHECK_API_KEY:'test-key'}, now:() => time, request:async url => {
    calls++; assert.equal(new URL(url).hostname,'proxycheck.io');
    return Response.json({status:'ok','8.8.8.8':{detections:{anonymous:false}}});
  }});
  assert.equal(await check({ip:'::ffff:8.8.8.8'}),'clear');
  assert.equal(await check({ip:'8.8.8.8'}),'clear'); assert.equal(calls,1);
  time = 60001; await check({ip:'8.8.8.8'}); assert.equal(calls,2);
});
test('VPN/proxy is blocked; failed, quota and malformed responses remain unknown', async () => {
  for (const [response, expected] of [
    [Response.json({status:'warning','8.8.8.8':{detections:{anonymous:true}}}),'blocked'],
    [Response.json({status:'denied'}, {status:429}),'unknown'],
    [Response.json({status:'ok','8.8.8.8':{}}),'unknown'],
  ]) {
    const check = createPunchNetworkCheck({env:{PUNCH_PROXYCHECK_API_KEY:'test'},request:async () => response});
    assert.equal(await check({ip:'8.8.8.8'}),expected);
  }
  const check = createPunchNetworkCheck({env:{PUNCH_PROXYCHECK_API_KEY:'test'},request:async () => {throw new Error('offline');}});
  assert.equal(await check({ip:'8.8.8.8'}),'unknown');
  assert.equal(await check({ip:'127.0.0.1'}),'unknown');
});
