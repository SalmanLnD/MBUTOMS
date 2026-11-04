import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestCache } from './requestCache.js';

test('identical concurrent reads share one request; expiry and force fetch fresh data', async () => {
  let now = 0;
  let calls = 0;
  const cache = createRequestCache({ clock: () => now, ttlMs: 100 });
  const fetcher = async () => ++calls;
  assert.deepEqual(await Promise.all([cache.get('user-a/month', fetcher), cache.get('user-a/month', fetcher)]), [1, 1]);
  assert.equal(await cache.get('user-a/month', fetcher), 1);
  assert.equal(await cache.get('user-b/month', fetcher), 2);
  now = 101;
  assert.equal(await cache.get('user-a/month', fetcher), 3);
  assert.equal(await cache.get('user-a/month', fetcher, { force: true }), 4);
});

test('a read started before mutation invalidation cannot repopulate the cache', async () => {
  const cache = createRequestCache();
  let finish;
  const old = cache.get('month', () => new Promise(resolve => { finish = resolve; }));
  await Promise.resolve();
  cache.clear();
  assert.equal(await cache.get('month', async () => 'new'), 'new');
  finish('old');
  assert.equal(await old, 'old');
  assert.equal(await cache.get('month', async () => 'incorrect'), 'new');
});

test('failed reads release their lock and the cache has a bounded number of records', async () => {
  const cache = createRequestCache({ maxEntries: 2 });
  await assert.rejects(cache.get('a', async () => { throw new Error('offline'); }), /offline/);
  assert.equal(await cache.get('a', async () => 'retry'), 'retry');
  await cache.get('b', async () => 'b');
  await cache.get('c', async () => 'c');
  assert.equal(await cache.get('a', async () => 'evicted'), 'evicted');
});
