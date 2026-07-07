import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ClassGroup from '../models/ClassGroup.js';
import Schedule from '../models/Schedule.js';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import { resolveTrainerScheduleCodes } from '../utils/trainerMappings.js';
import {
  buildAllExpectedSchedulePayloads,
  partitionSchedulesByExpectation,
} from '../utils/timetableSourceExpectations.js';
import {
  createIntegrityChecker,
  findClassTimeOverlaps,
  findResolvedTrainerTimeOverlaps,
  findTrainerTimeOverlaps,
  formatScheduleLabel,
  integrityScheduleKey,
  summarizeIntegrityResults,
} from '../utils/timetableIntegrity.js';

dotenv.config();

const checker = createIntegrityChecker();

await mongoose.connect(process.env.MONGODB_URI);

const [schedules, subjects, trainers, classes] = await Promise.all([
  Schedule.find().lean(),
  Subject.find().lean(),
  Trainer.find().lean(),
  ClassGroup.countDocuments({ status: 'active' }),
]);

const subjectById = new Map(subjects.map((subject) => [String(subject._id), subject]));
const subjectByCode = new Map(subjects.map((subject) => [subject.code, subject]));

const trainerByCode = new Map();
const trainerIdByCode = new Map();
for (const trainer of trainers) {
  resolveTrainerScheduleCodes(trainer).forEach((code) => {
    trainerByCode.set(code, trainer);
    trainerIdByCode.set(code, String(trainer._id));
  });
}

const activeClassByKey = new Map();
const activeClasses = await ClassGroup.find({ status: 'active' }).lean();
for (const cls of activeClasses) {
  activeClassByKey.set(`${cls.department}|${cls.section}|${cls.currentSemester}`, cls);
  activeClassByKey.set(`${cls.department}|${cls.section}`, cls);
}

const resolveRegisteredClass = ({ department, section, semester }) => {
  const sem = String(semester || '').trim();
  if (sem) {
    return (
      activeClassByKey.get(`${department}|${section}|${sem}`) ||
      activeClassByKey.get(`${department}|${section}`)
    );
  }
  return activeClassByKey.get(`${department}|${section}`);
};

console.log(`Loaded ${schedules.length} schedule(s), ${trainers.length} trainer(s), ` +
  `${subjects.length} subject(s), ${classes} active class(es).\n`);

checker.check('Database has timetable schedules', schedules.length > 0, `found ${schedules.length}`);

const trainerOverlaps = findTrainerTimeOverlaps(schedules);
checker.check(
  'No trainer time overlaps (by trainerCode)',
  trainerOverlaps.length === 0,
  trainerOverlaps
    .slice(0, 5)
    .map(({ left, right }) => `${formatScheduleLabel(left)} vs ${formatScheduleLabel(right)}`)
    .join('; ')
);

const resolvedTrainerOverlaps = findResolvedTrainerTimeOverlaps(schedules, trainerIdByCode);
checker.check(
  'No trainer time overlaps (resolved trainer identity)',
  resolvedTrainerOverlaps.length === 0,
  resolvedTrainerOverlaps
    .slice(0, 5)
    .map(({ left, right }) => `${formatScheduleLabel(left)} vs ${formatScheduleLabel(right)}`)
    .join('; ')
);

const classOverlaps = findClassTimeOverlaps(schedules);
checker.check(
  'No class time overlaps',
  classOverlaps.length === 0,
  classOverlaps
    .slice(0, 5)
    .map(
      ({ left, right }) =>
        `${left.department} ${left.section} ${left.day}: ` +
        `${left.startTime}-${left.endTime} (${left.subjectCode}) vs ` +
        `${right.startTime}-${right.endTime} (${right.subjectCode})`
    )
    .join('; ')
);

const missingTrainerCodes = new Set();
const brokenSubjectRefs = [];
const missingSubjectCodes = new Set();
const subjectCodeMismatches = [];
const unregisteredClasses = [];
const semesterMismatches = [];

for (const schedule of schedules) {
  if (!trainerByCode.get(schedule.trainerCode)) {
    missingTrainerCodes.add(schedule.trainerCode);
  }

  if (!schedule.subjectCode) {
    brokenSubjectRefs.push(integrityScheduleKey(schedule));
  } else if (!subjectByCode.has(schedule.subjectCode)) {
    missingSubjectCodes.add(schedule.subjectCode);
  }

  if (schedule.subject) {
    const linked = subjectById.get(String(schedule.subject));
    if (!linked) {
      brokenSubjectRefs.push(integrityScheduleKey(schedule));
    } else if (schedule.subjectCode && linked.code !== schedule.subjectCode) {
      subjectCodeMismatches.push(
        `${integrityScheduleKey(schedule)}: ref=${linked.code}, code=${schedule.subjectCode}`
      );
    }
  }

  const registeredClass = resolveRegisteredClass({
    department: schedule.department,
    section: schedule.section,
    semester: schedule.semester,
  });

  if (!registeredClass) {
    unregisteredClasses.push(`${schedule.department} ${schedule.section} (${schedule.semester})`);
  } else if (schedule.semester && registeredClass.currentSemester !== schedule.semester) {
    semesterMismatches.push(
      `${schedule.department} ${schedule.section}: schedule=${schedule.semester}, class=${registeredClass.currentSemester}`
    );
  }
}

checker.check(
  'Every schedule subjectCode exists in subjects collection',
  missingSubjectCodes.size === 0,
  [...missingSubjectCodes].join(', ')
);

checker.check(
  'Every schedule trainerCode resolves to a trainer',
  missingTrainerCodes.size === 0,
  [...missingTrainerCodes].join(', ')
);

checker.check(
  'Every schedule subject ref is valid',
  brokenSubjectRefs.length === 0,
  brokenSubjectRefs.slice(0, 5).join('; ')
);

checker.check(
  'Schedule subjectCode matches subject ref',
  subjectCodeMismatches.length === 0,
  subjectCodeMismatches.slice(0, 5).join('; ')
);

checker.check(
  'Every schedule class is registered',
  unregisteredClasses.length === 0,
  [...new Set(unregisteredClasses)].slice(0, 10).join('; ')
);

checker.check(
  'Schedule semester matches registered class semester',
  semesterMismatches.length === 0,
  [...new Set(semesterMismatches)].slice(0, 10).join('; ')
);

const trainerSubjectIssues = [];

for (const trainer of trainers) {
  const codes = resolveTrainerScheduleCodes(trainer);
  const trainerSchedules = schedules.filter((schedule) => codes.includes(schedule.trainerCode));
  if (!trainerSchedules.length) continue;

  const taughtSubjectIds = new Set(
    trainerSchedules
      .map((schedule) => {
        if (schedule.subject) return String(schedule.subject);
        const subject = subjectByCode.get(schedule.subjectCode);
        return subject ? String(subject._id) : '';
      })
      .filter(Boolean)
  );

  const trainerSubjectSet = new Set((trainer.subjects || []).map((id) => String(id)));

  for (const subjectId of taughtSubjectIds) {
    if (!trainerSubjectSet.has(subjectId)) {
      const subject = subjectById.get(subjectId);
      trainerSubjectIssues.push(
        `${trainer.name} (${trainer.employeeId}) missing subject link: ${subject?.code || subjectId}`
      );
    }

    const subject = subjectById.get(subjectId);
    if (subject) {
      const eligible = new Set((subject.trainerEligible || []).map((id) => String(id)));
      if (!eligible.has(String(trainer._id))) {
        trainerSubjectIssues.push(
          `${subject.code} missing trainerEligible link for ${trainer.name} (${trainer.employeeId})`
        );
      }
    }
  }
}

checker.check(
  'Trainer-subject links are bidirectional for scheduled trainers',
  trainerSubjectIssues.length === 0,
  trainerSubjectIssues.slice(0, 10).join('; ')
);

const expectedPayloads = buildAllExpectedSchedulePayloads();
const actualKeyCounts = new Map();
for (const schedule of schedules) {
  const key = integrityScheduleKey(schedule);
  actualKeyCounts.set(key, (actualKeyCounts.get(key) || 0) + 1);
}

const missingExpected = [];
const duplicateExpected = [];

for (const payload of expectedPayloads) {
  const key = integrityScheduleKey(payload);
  const count = actualKeyCounts.get(key) || 0;
  if (count === 0) missingExpected.push(key);
  if (count > 1) duplicateExpected.push(`${key} (x${count})`);
}

checker.check(
  'All imported timetable definitions exist in the database',
  missingExpected.length === 0,
  missingExpected.slice(0, 10).join('; ')
);

checker.check(
  'No duplicate rows for a single expected timetable slot',
  duplicateExpected.length === 0,
  duplicateExpected.slice(0, 10).join('; ')
);

const { unexpected } = partitionSchedulesByExpectation(schedules);
checker.check(
  'No unexpected timetable rows outside known imports',
  unexpected.length === 0,
  unexpected
    .slice(0, 10)
    .map((schedule) => integrityScheduleKey(schedule))
    .join('; '),
  { warn: unexpected.length > 0 }
);

const schedulesByTrainer = new Map();
for (const schedule of schedules) {
  const trainerId = trainerIdByCode.get(schedule.trainerCode) || schedule.trainerCode;
  if (!schedulesByTrainer.has(trainerId)) schedulesByTrainer.set(trainerId, []);
  schedulesByTrainer.get(trainerId).push(schedule);
}

for (const trainer of trainers) {
  const trainerSchedules = schedulesByTrainer.get(String(trainer._id)) || [];
  if (!trainerSchedules.length) continue;

  const trainerOverlapsForOne = findTrainerTimeOverlaps(trainerSchedules);
  checker.check(
    `Trainer has no internal overlaps: ${trainer.name}`,
    trainerOverlapsForOne.length === 0,
    trainerOverlapsForOne
      .map(({ left, right }) => `${left.day} ${left.startTime} vs ${right.startTime}`)
      .join('; ')
  );
}

await mongoose.disconnect();

const exitCode = summarizeIntegrityResults(checker);
process.exit(exitCode);
