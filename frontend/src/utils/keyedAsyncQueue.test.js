import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeyedAsyncQueue } from './keyedAsyncQueue.js';

test('same-resource writes stay ordered while independent resources run concurrently', async () => {
  const queue = createKeyedAsyncQueue();
  const calls = [];
  let release;
  const first = queue.run('cell-a', async () => {
    calls.push('a1');
    await new Promise(resolve => { release = resolve; });
    calls.push('a1 done');
  });
  const second = queue.run('cell-a', () => { calls.push('a2'); });
  const independent = queue.run('cell-b', () => { calls.push('b'); });
  assert.equal(queue.has('cell-a'), true);
  await independent;
  assert.deepEqual(calls, ['a1', 'b']);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(calls, ['a1', 'b', 'a1 done', 'a2']);
  assert.equal(queue.has('cell-a'), false);
});

test('failed writes release the resource and do not discard the following edit', async () => {
  const queue = createKeyedAsyncQueue();
  const failure = new Error('save failed');
  const first = queue.run('cell', () => { throw failure; });
  const second = queue.run('cell', () => 'new edit saved');
  await assert.rejects(first, error => error === failure);
  assert.equal(await second, 'new edit saved');
  assert.equal(queue.has('cell'), false);
});
