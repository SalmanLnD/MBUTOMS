import test from 'node:test';
import assert from 'node:assert/strict';
import { runWithAcademicTerm } from '../../utils/academicTermContext.js';
import { academicCacheKey, academicSettingKey, academicExportUrl } from '../../utils/academicCacheKey.js';
import { createAsyncReportCache } from '../../utils/asyncReportCache.js';

const context = (id, revision = 1) => ({ term: { _id: id }, revision });

test('concurrent semester reports never share a cached payload', async () => {
  const read = createAsyncReportCache();
  const results = await Promise.all([
    runWithAcademicTerm(context('odd'), () => read('same-report', async () => 'odd marks')),
    runWithAcademicTerm(context('even'), () => read('same-report', async () => 'even marks')),
  ]);
  assert.deepEqual(results, ['odd marks', 'even marks']);
  assert.equal(await runWithAcademicTerm(context('odd'), () => read('same-report', () => assert.fail('should hit'))), 'odd marks');
  assert.equal(await runWithAcademicTerm(context('odd', 2), () => read('same-report', () => 'published revision')), 'published revision');
});

test('sheet links and credentials stay bound to their semester', () => {
  assert.equal(academicSettingKey('key'), 'key');
  runWithAcademicTerm(context('odd'), () => {
    assert.equal(academicSettingKey('key'), 'term:odd:key');
    assert.equal(academicExportUrl('https://example.test/export'), 'https://example.test/export?termId=odd');
  });
  const first = runWithAcademicTerm(context('odd'), () => academicCacheKey('x'));
  const second = runWithAcademicTerm(context('even'), () => academicCacheKey('x'));
  assert.notEqual(first, second);
});
