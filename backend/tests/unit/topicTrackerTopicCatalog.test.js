import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IDSA_TOPIC_TRACKER_TOPICS,
  PSTJ_TOPIC_TRACKER_TOPICS,
  PSTP_TOPIC_TRACKER_TOPICS,
  DSAP_TOPIC_TRACKER_TOPICS,
  LRRE_TOPIC_TRACKER_TOPICS,
  QAVA_TOPIC_TRACKER_TOPICS,
  TOPIC_TRACKER_SPECIAL_TOPICS,
  getTopicOptionsForSubject,
  getTopicOptionsForSubjectDoc,
  isAllowedTopicForSubject,
} from '../../utils/topicTrackerTopicCatalog.js';
import { IDSA_SUBJECT, PSTP_SUBJECT, DSAP_SUBJECT } from '../../utils/trainerMappings.js';
import { PSTJ_SUBJECT_CODE, QAVA_SUBJECT_CODE } from '../../utils/subjectSlotTimings.js';
import { LRRE_SUBJECT_CODE } from '../../utils/lrreVSemesterTimetable.js';

test('IDSA topic catalog includes revision and class test', () => {
  assert.ok(IDSA_TOPIC_TRACKER_TOPICS.includes('Revision'));
  assert.ok(IDSA_TOPIC_TRACKER_TOPICS.includes('Class Test'));
  assert.deepEqual(TOPIC_TRACKER_SPECIAL_TOPICS, ['Revision', 'Class Test']);
});

test('subject.topics overrides static catalog for dropdown and validation', () => {
  const subject = {
    code: IDSA_SUBJECT.code,
    topics: ['Custom Topic A', 'Revision'],
  };
  assert.deepEqual(getTopicOptionsForSubjectDoc(subject), ['Custom Topic A', 'Revision']);
  assert.equal(isAllowedTopicForSubject(IDSA_SUBJECT.code, 'Custom Topic A', subject.topics), true);
  assert.equal(isAllowedTopicForSubject(IDSA_SUBJECT.code, 'Introduction to Data structures', subject.topics), false);
});

test('IDSA topic catalog is restricted to approved topics only', () => {
  const topics = getTopicOptionsForSubject(IDSA_SUBJECT.code);
  assert.ok(topics);
  assert.ok(topics.length >= 70);
  assert.equal(isAllowedTopicForSubject(IDSA_SUBJECT.code, 'Introduction to Data structures'), true);
  assert.equal(isAllowedTopicForSubject(IDSA_SUBJECT.code, 'Random free text'), false);
  assert.equal(isAllowedTopicForSubject('UNKNOWN-SUBJECT', 'Anything goes'), true);
});

test('PSTJ topic catalog includes revision, class test, and unique topics', () => {
  const topics = getTopicOptionsForSubject(PSTJ_SUBJECT_CODE);
  assert.ok(topics);
  assert.equal(topics, PSTJ_TOPIC_TRACKER_TOPICS);
  assert.ok(topics.includes('Revision'));
  assert.ok(topics.includes('Class Test'));
  assert.ok(topics.includes('Introduction to Java'));
  assert.equal(new Set(topics).size, topics.length, 'PSTJ topics must be unique');
  assert.equal(isAllowedTopicForSubject(PSTJ_SUBJECT_CODE, 'Collections Lab: CRUD operations'), true);
  assert.equal(isAllowedTopicForSubject(PSTJ_SUBJECT_CODE, 'Random free text'), false);
});

test('PSTP topic catalog includes revision, class test, and unique topics', () => {
  const topics = getTopicOptionsForSubject(PSTP_SUBJECT.code);
  assert.ok(topics);
  assert.equal(topics, PSTP_TOPIC_TRACKER_TOPICS);
  assert.ok(topics.includes('Revision'));
  assert.ok(topics.includes('Class Test'));
  assert.ok(topics.includes('Introduction to Python'));
  assert.ok(topics.includes('Seaborn: Plot Customization & Styling'));
  assert.equal(new Set(topics).size, topics.length, 'PSTP topics must be unique');
  assert.equal(isAllowedTopicForSubject(PSTP_SUBJECT.code, 'NumPy Basics'), true);
  assert.equal(isAllowedTopicForSubject(PSTP_SUBJECT.code, 'Random free text'), false);
});

test('DSAP topic catalog includes revision, class test, and unique topics', () => {
  const topics = getTopicOptionsForSubject(DSAP_SUBJECT.code);
  assert.ok(topics);
  assert.equal(topics, DSAP_TOPIC_TRACKER_TOPICS);
  assert.ok(topics.includes('Revision'));
  assert.ok(topics.includes('Class Test'));
  assert.ok(topics.includes('Introduction to Linked List'));
  assert.ok(topics.includes('Problems on Hashing - 3: Efficient Library Book Tracking System, Valid Anagram'));
  assert.equal(new Set(topics).size, topics.length, 'DSAP topics must be unique');
  assert.equal(isAllowedTopicForSubject(DSAP_SUBJECT.code, 'Introduction to Graphs'), true);
  assert.equal(isAllowedTopicForSubject(DSAP_SUBJECT.code, 'Random free text'), false);
});

test('LRRE topic catalog includes revision, class test, and unique topics', () => {
  const topics = getTopicOptionsForSubject(LRRE_SUBJECT_CODE);
  assert.ok(topics);
  assert.equal(topics, LRRE_TOPIC_TRACKER_TOPICS);
  assert.ok(topics.includes('Revision'));
  assert.ok(topics.includes('Class Test'));
  assert.ok(topics.includes('Introduction to Logical Reasoning: Types of reasoning, exam patterns, problem-solving approach'));
  assert.ok(topics.includes('Placement Readiness Assessment: Comprehensive LR test, GD, PI feedback and action plan'));
  assert.equal(new Set(topics).size, topics.length, 'LRRE topics must be unique');
  assert.equal(isAllowedTopicForSubject(LRRE_SUBJECT_CODE, 'Syllogisms: Venn approach, statement-conclusion'), true);
  assert.equal(isAllowedTopicForSubject(LRRE_SUBJECT_CODE, 'Random free text'), false);
});

test('QAVA topic catalog includes revision, class test, and unique topics', () => {
  const topics = getTopicOptionsForSubject(QAVA_SUBJECT_CODE);
  assert.ok(topics);
  assert.equal(topics, QAVA_TOPIC_TRACKER_TOPICS);
  assert.ok(topics.includes('Revision'));
  assert.ok(topics.includes('Class Test'));
  assert.ok(topics.includes('Numbers system: Number system, Power cycle'));
  assert.ok(topics.includes('Critical Reasoning: Types of Questions for QAVA'));
  assert.equal(new Set(topics).size, topics.length, 'QAVA topics must be unique');
  assert.equal(isAllowedTopicForSubject(QAVA_SUBJECT_CODE, 'Ratio and Proportion: Ratio, Proportion'), true);
  assert.equal(isAllowedTopicForSubject(QAVA_SUBJECT_CODE, 'Random free text'), false);
});
