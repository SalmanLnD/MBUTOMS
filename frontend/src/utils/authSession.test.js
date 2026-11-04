import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Load the actual service with an isolated transport instead of a browser Axios instance.
const source = await readFile(new URL('../services/authService.js', import.meta.url), 'utf8');
let moduleId = 0;
const service = async (api) => {
  const key = `__authSessionTest${moduleId++}`;
  globalThis[key] = api;
  try {
    return await import(`data:text/javascript,${encodeURIComponent(source.replace(
      "import api from './api.js';", `const api = globalThis[${JSON.stringify(key)}];`,
    ))}`);
  } finally { delete globalThis[key]; }
};

test('login verifies the cookie before returning the authoritative user', async () => {
  const calls = [];
  const user = { _id: 'user-1', role: 'trainer' };
  const auth = await service({
    async post(path) { calls.push(path); return { data: user }; },
    async get(path, config) {
      calls.push(path);
      assert.equal(config.skipSessionExpired, true);
      assert.equal(config.skipRetry, true);
      return { data: { ...user, name: 'Fresh profile' } };
    },
  });
  assert.equal((await auth.login({})).name, 'Fresh profile');
  assert.deepEqual(calls, ['/auth/login', '/auth/me']);
});

test('blocked cookies fail login instead of entering an unauthenticated app', async () => {
  const failure = new Error('Not authorized, no token');
  const auth = await service({
    async post() { return { data: { _id: 'user-1' } }; },
    async get() { throw failure; },
  });
  await assert.rejects(auth.login({}), error => error === failure);
});

test('SPA fallback HTML and mismatched sessions cannot count as successful login', async () => {
  for (const data of ['<!doctype html>', { _id: 'other-user', role: 'trainer' }]) {
    const auth = await service({
      async post() { return { data: { _id: 'user-1' } }; },
      async get() { return { data }; },
    });
    await assert.rejects(auth.login({}));
  }
});
