import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskDemoValue } from './demoMask.js';
test('demo detail fields show the first half and mask the rest, including the requested CAMU example',()=>{
  assert.equal(maskDemoValue('adjfaculty-cdc086'),'adjfacultxxxxxxxx');
  assert.equal(maskDemoValue('123456'),'123xxx');
  assert.equal(maskDemoValue(5),'x'); assert.equal(maskDemoValue('-'),'-');
  assert.equal(maskDemoValue('அஆஇஈ'),'அஆxx');
});
