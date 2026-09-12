import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTopicTrackerClassSummary,
  buildRemainingTrainingHoursByClass,
  mergeOverviewTrainerNames,
  normalizeTopicTrackerClassLabel,
} from '../../utils/topicTrackerSessions.js';
import Schedule from '../../models/Schedule.js';
import Subject from '../../models/Subject.js';
import Trainer from '../../models/Trainer.js';
import Leave from '../../models/Leave.js';
import ClassCancellation from '../../models/ClassCancellation.js';
import OfficialHoliday from '../../models/OfficialHoliday.js';
import TopicTrackerEntry from '../../models/TopicTrackerEntry.js';
import ClassGroup from '../../models/ClassGroup.js';
import { clearSubjectStartDateCache } from '../../utils/subjectStartDate.js';

test('trainer overview shows original and replacement trainers with slash separation', () => {
  const names = mergeOverviewTrainerNames([], {
    trainerName: 'Jahnavi M',
    originalTrainerName: 'Jakka Rounak Reddy',
    replacementTrainerName: 'Jahnavi M',
  });

  assert.equal(names.join(' / '), 'Jakka Rounak Reddy / Jahnavi M');
});

test('trainer overview does not duplicate names across multiple replaced slots', () => {
  const session = {
    originalTrainerName: 'Jakka Rounak Reddy',
    replacementTrainerName: 'Jahnavi M',
  };
  const names = mergeOverviewTrainerNames(
    mergeOverviewTrainerNames([], session),
    session
  );

  assert.deepEqual(names, ['Jakka Rounak Reddy', 'Jahnavi M']);
});

test('class summary class labels merge section suffix variants', () => {
  assert.equal(normalizeTopicTrackerClassLabel("AIML, Sem V - A7'-CC"), 'AIML, Sem V - A7');
  assert.equal(normalizeTopicTrackerClassLabel("AIML, Sem V - A7' - CC"), 'AIML, Sem V - A7');
  assert.equal(normalizeTopicTrackerClassLabel('AIML, Sem V - A6-Devops'), 'AIML, Sem V - A6');
  assert.equal(normalizeTopicTrackerClassLabel('AIML, Sem V - A6'), 'AIML, Sem V - A6');
});

test('remaining training hours follow valid main-trainer timetable slots', async (t) => {
  const query = (rows) => ({
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    lean: async () => rows,
  });
  const activeSubject = {
    _id: 'subject-active',
    code: 'LRRE',
    name: 'Logical Reasoning and Recruitment Essentials',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2026-09-18T00:00:00Z'),
  };
  const endedSubject = {
    _id: 'subject-ended',
    code: 'DONE',
    name: 'Ended Subject',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2026-09-11T00:00:00Z'),
  };
  const trainer = {
    _id: 'trainer-main',
    employeeId: 'MAIN',
    name: 'Divya K',
    scheduleTrainerCodes: [],
  };
  const replacementTrainer = {
    _id: 'trainer-replacement',
    employeeId: 'REPL',
    name: 'Replacement Trainer',
    scheduleTrainerCodes: [],
  };
  const schedule = (id, day, startTime, endTime, section = 'A6-Devops', subject = activeSubject) => ({
    _id: id,
    day,
    startTime,
    endTime,
    trainerCode: 'MAIN',
    department: 'AIML',
    section,
    semester: 'V',
    subject,
    subjectCode: subject.code,
  });
  const schedules = [
    schedule('today-done', 'Saturday', '09:00', '10:30'),
    schedule('today-pending', 'Saturday', '11:00', '12:00'),
    schedule('monday-normal', 'Monday', '09:00', '10:00'),
    schedule('tuesday-holiday', 'Tuesday', '09:00', '11:00'),
    schedule('wednesday-cancelled', 'Wednesday', '09:00', '10:00'),
    schedule('thursday-leave-replacement', 'Thursday', '09:00', '10:30'),
    schedule('friday-long', 'Friday', '09:00', '11:15'),
    schedule('ended-subject-slot', 'Saturday', '09:00', '12:00', 'A7-CC', endedSubject),
  ];

  t.mock.method(Subject, 'find', () => query([activeSubject, endedSubject]));
  t.mock.method(Schedule, 'find', () => query(schedules));
  t.mock.method(Trainer, 'find', () => query([trainer, replacementTrainer]));
  t.mock.method(ClassGroup, 'find', () => query([]));
  t.mock.method(OfficialHoliday, 'find', () => query([
    { date: new Date('2026-09-15T00:00:00Z'), name: 'Holiday' },
  ]));
  t.mock.method(ClassCancellation, 'find', () => query([
    { date: new Date('2026-09-16T00:00:00Z'), schedules: ['wednesday-cancelled'] },
  ]));
  t.mock.method(TopicTrackerEntry, 'find', () => query([
    {
      schedule: 'today-done',
      date: new Date('2026-09-12T00:00:00Z'),
      trackerStatus: 'closed',
      sessionStatus: 'completed',
    },
  ]));
  t.mock.method(Leave, 'find', () => query([
    {
      startDate: new Date('2026-09-17T00:00:00Z'),
      endDate: new Date('2026-09-17T00:00:00Z'),
      affectedSchedules: ['thursday-leave-replacement'],
      replacements: [{
        schedule: 'thursday-leave-replacement',
        replacementTrainer: 'trainer-replacement',
      }],
    },
  ]));
  clearSubjectStartDateCache();

  const result = await buildRemainingTrainingHoursByClass({
    subjects: [activeSubject],
    today: '2026-09-12',
  });
  const rows = [...result.values()];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].trainerName, 'Divya K');
  assert.equal(rows[0].branchYearSection, 'AIML, Sem V - A6');
  assert.equal(rows[0].remainingTrainingHours, 4.3);
  assert.equal(rows.some((row) => row.trainerName === 'Replacement Trainer'), false);

  const ended = await buildRemainingTrainingHoursByClass({
    subjects: [endedSubject],
    today: '2026-09-12',
  });
  assert.equal(ended.size, 0);

  clearSubjectStartDateCache();
});

test('class summary uses main trainer names and merged class rows', async (t) => {
  const query = (rows) => ({
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    lean: async () => rows,
  });
  const subject = {
    _id: 'subject-active',
    code: 'LRRE',
    name: 'Logical Reasoning and Recruitment Essentials',
    topics: ['Numbers', 'Logic'],
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2026-09-18T00:00:00Z'),
  };
  const mainTrainer = {
    _id: 'trainer-main',
    employeeId: 'MAIN',
    name: 'Divya K',
    scheduleTrainerCodes: [],
  };
  const replacementTrainer = {
    _id: 'trainer-replacement',
    employeeId: 'REPL',
    name: 'Replacement Trainer',
    scheduleTrainerCodes: [],
  };
  const entries = [
    {
      subject: subject._id,
      trainer: replacementTrainer._id,
      trainerName: replacementTrainer.name,
      branchYearSection: "AIML, Sem V - A7' - CC",
      topicModulesCovered: ['Numbers'],
      date: new Date('2026-09-10T00:00:00Z'),
      attendancePercent: 90,
    },
    {
      subject: subject._id,
      trainer: mainTrainer._id,
      trainerName: mainTrainer.name,
      branchYearSection: 'AIML, PY 2029 Sem V - A7',
      topicModulesCovered: ['Logic'],
      date: new Date('2026-09-11T00:00:00Z'),
      attendancePercent: 80,
    },
  ];

  t.mock.method(Subject, 'find', () => query([subject]));
  t.mock.method(Schedule, 'find', () => query([
    {
      _id: 'future-slot',
      day: 'Monday',
      startTime: '09:00',
      endTime: '10:00',
      trainerCode: 'MAIN',
      department: 'AIML',
      section: 'A7-CC',
      semester: 'V',
      subject,
      subjectCode: subject.code,
    },
  ]));
  t.mock.method(Trainer, 'find', () => query([mainTrainer, replacementTrainer]));
  t.mock.method(ClassGroup, 'find', () => query([{
    department: 'AIML',
    section: 'A7-CC',
    currentSemester: 'V',
    py: 2029,
    status: 'active',
  }]));
  t.mock.method(OfficialHoliday, 'find', () => query([]));
  t.mock.method(ClassCancellation, 'find', () => query([]));
  t.mock.method(Leave, 'find', () => query([]));
  t.mock.method(TopicTrackerEntry, 'find', (filter) => {
    if (filter.trackerStatus === 'closed') return query(entries);
    return query([]);
  });
  clearSubjectStartDateCache();

  const result = await buildTopicTrackerClassSummary({
    subjectId: subject._id,
    user: { role: 'admin' },
    today: '2026-09-12',
  });

  assert.equal(result.subjects.length, 1);
  assert.equal(result.subjects[0].classes.length, 1);
  assert.equal(result.subjects[0].classes[0].trainerName, 'Divya K');
  assert.equal(result.subjects[0].classes[0].branchYearSection, 'AIML, PY 2029 Sem V - A7');
  assert.equal(result.subjects[0].classes[0].closedSlots, 2);
  assert.equal(result.subjects[0].classes[0].remainingTrainingHours, 1);

  clearSubjectStartDateCache();
});
