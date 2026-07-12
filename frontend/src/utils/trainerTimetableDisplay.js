import { getSubjectSlotProfile } from './subjectSlotTimings.js';
import { getEffectiveSubjectCode } from './scheduleSubject.js';
import { resolveTrainerGridSlots } from './timetableGrid.js';
import { shouldShowTimingsInCells } from './timetableSlots.js';

export const buildTrainerSubjectsForDisplay = (trainer, visibleSchedules, allSubjects = []) => {
  const scheduledCodes = [
    ...new Set(
      visibleSchedules
        .map((schedule) => getEffectiveSubjectCode(schedule, trainer?.employeeId))
        .filter(Boolean)
    ),
  ];
  const codes = scheduledCodes.length
    ? scheduledCodes
    : [...new Set((trainer?.subjects || []).map((subject) => subject.code).filter(Boolean))];

  return codes.map((code) => {
    const matched = allSubjects.find((subject) => subject.code === code);
    if (matched) return matched;

    const assigned = (trainer?.subjects || []).find((subject) => subject.code === code);
    if (assigned?.slotTimings) return assigned;

    const profile = getSubjectSlotProfile(code);
    if (!profile) return null;
    return {
      _id: code,
      code,
      name: assigned?.name || code,
      slotCount: profile.slotCount,
      slotTimings: profile.timings,
    };
  }).filter(Boolean);
};

export const buildTrainerSubjectLabel = (
  visibleSchedules,
  trainerSubjects,
  selectedSubject,
  trainerCode
) => {
  if (selectedSubject) {
    return `${selectedSubject.name} (${selectedSubject.code})`;
  }

  const codes = [
    ...new Set([
      ...visibleSchedules
        .map((schedule) => getEffectiveSubjectCode(schedule, trainerCode))
        .filter(Boolean),
      ...trainerSubjects.map((subject) => subject.code).filter(Boolean),
    ]),
  ];

  if (codes.length > 1) return 'All subjects';
  if (codes.length === 1) {
    const matched = trainerSubjects.find((subject) => subject.code === codes[0]);
    return matched ? `${matched.name} (${matched.code})` : codes[0];
  }
  return '';
};

export const resolveTrainerTimetableGridOptions = ({
  trainer,
  visibleSchedules,
  allSubjects = [],
  selectedSubject = null,
}) => {
  const trainerCode = trainer?.employeeId;
  const trainerSubjectsForDisplay = buildTrainerSubjectsForDisplay(
    trainer,
    visibleSchedules,
    allSubjects
  );
  const showTimingsInCells = shouldShowTimingsInCells(
    trainerSubjectsForDisplay,
    selectedSubject
  );
  const fixedSlots = resolveTrainerGridSlots({
    selectedSubject,
    trainerSubjects: trainerSubjectsForDisplay,
    visibleSchedules,
    showTimingsInCells,
  });
  const subjectLabel = buildTrainerSubjectLabel(
    visibleSchedules,
    trainerSubjectsForDisplay,
    selectedSubject,
    trainerCode
  );

  return {
    fixedSlots,
    showTimingsInCells,
    subjectLabel,
    showSubjectInCells: !selectedSubject,
  };
};
