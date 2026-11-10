import test from 'node:test';
import assert from 'node:assert/strict';
import { isAcademicPath, isAcademicPage, safeCalendarUrl, setAcademicTransport, getAcademicTransport } from './academicTerm.js';

test('academic context excludes shared operational API routes', () => {
  for (const path of ['/students/bulk', '/subjects', '/classes/1', '/schedules/public', '/topic-tracker/export', '/student-test-reports/grid', '/sheets/link']) assert.equal(isAcademicPath(path), true);
  for (const path of ['/trainers', '/leaves', '/replacements', '/attendance', '/venues', '/observations', '/academic-terms/context', '/subjects-other']) assert.equal(isAcademicPath(path), false);
  assert.equal(isAcademicPage('/trainers/123/schedule'), true);
  assert.equal(isAcademicPage('/performance'), false);
});

test('calendar links reject executable URLs and embedded credentials', () => {
  assert.equal(safeCalendarUrl('javascript:alert(1)'), '');
  assert.equal(safeCalendarUrl('http://example.com/calendar'), '');
  assert.equal(safeCalendarUrl('https://user:pass@example.com'), '');
  assert.equal(safeCalendarUrl('https://example.com/calendar'), 'https://example.com/calendar');
});

test('term changes invalidate old in-flight work and stale contexts stay blocked', () => {
  setAcademicTransport({ enabled: true, termId: 'odd', revision: 1, stale: false });
  const old = getAcademicTransport();
  setAcademicTransport({ enabled: true, termId: 'even', revision: 2, stale: false });
  assert.equal(old.signal.aborted, true);
  assert.ok(getAcademicTransport().generation > old.generation);
  setAcademicTransport({ stale: true });
  assert.equal(getAcademicTransport().stale, true);
  setAcademicTransport({ enabled: false, termId: '', revision: 0, stale: false });
});
