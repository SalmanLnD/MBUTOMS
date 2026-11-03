import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOriginAllowed } from '../../utils/cors.js';
import { escapeRegex } from '../../utils/regex.js';

test('credentialed browser requests allow only configured origins', t => {
  const previous = process.env.CLIENT_URL;
  process.env.CLIENT_URL = 'https://mbutoms.onrender.com/';
  t.after(() => { if (previous === undefined) delete process.env.CLIENT_URL; else process.env.CLIENT_URL = previous; });
  assert.equal(isOriginAllowed('https://mbutoms.onrender.com'), true);
  assert.equal(isOriginAllowed('https://unrelated.onrender.com'), false);
  assert.equal(isOriginAllowed('https://unrelated.vercel.app'), false);
});

test('search treats regular expression operators as literal text', () => {
  for (const term of ['a.b', 'a*b', '[test]', '(a+)+', 'x\\y']) {
    const expression = new RegExp(escapeRegex(term), 'i');
    assert.equal(expression.test(term), true);
    assert.equal(expression.test('unrelated text'), false);
  }
  assert.equal(new RegExp(escapeRegex('a.b')).test('axb'), false);
});
