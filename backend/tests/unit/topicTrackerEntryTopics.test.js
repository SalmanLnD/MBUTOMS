import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTopicModulesCovered,
  getEntryTopicModules,
  normalizeTopicModulesCovered,
} from '../../utils/topicTrackerEntryTopics.js';

test('normalizes multiple topics and removes blanks and duplicates', () => {
  assert.deepEqual(
    normalizeTopicModulesCovered(['Topic A', ' Topic B ', '', 'Topic A']),
    ['Topic A', 'Topic B']
  );
});

test('keeps a legacy topic containing commas as one topic', () => {
  const legacyTopic = 'Arrays: insertion, deletion, and traversal';
  assert.deepEqual(normalizeTopicModulesCovered(undefined, legacyTopic), [legacyTopic]);
  assert.deepEqual(getEntryTopicModules({ topicModuleCovered: legacyTopic }), [legacyTopic]);
});

test('formats multiple topics in one comma-separated sheet cell', () => {
  assert.equal(
    formatTopicModulesCovered(['Topic A', 'Topic B', 'Topic C']),
    'Topic A, Topic B, Topic C'
  );
});

test('topic tracker day window includes both UTC and IST midnight storage', async () => {
  const { getLeaveDayWindow, toLeaveDateKey } = await import('../../utils/leaveDateRange.js');
  const window = getLeaveDayWindow('2026-07-14');
  const utcMidnight = new Date('2026-07-14T00:00:00.000Z');
  const istMidnight = new Date('2026-07-14T00:00:00+05:30');

  assert.equal(toLeaveDateKey('2026-07-14'), '2026-07-14');
  assert.ok(utcMidnight >= window.start && utcMidnight < window.endExclusive);
  assert.ok(istMidnight >= window.start && istMidnight < window.endExclusive);
});
