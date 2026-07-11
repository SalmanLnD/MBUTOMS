const sanitizeVenue = (venue) => {
  if (!venue || typeof venue !== 'object') return null;
  return {
    name: venue.name || '',
    building: venue.building || '',
    floor: venue.floor || '',
  };
};

export const sanitizeScheduleForPublic = (schedule) => ({
  day: schedule.day,
  startTime: schedule.startTime,
  endTime: schedule.endTime,
  department: schedule.department,
  section: schedule.section,
  subjectCode: schedule.subjectCode || '',
  slot: schedule.slot || '',
  semester: schedule.semester || '',
  isLab: Boolean(schedule.isLab),
  isProject: Boolean(schedule.isProject),
  venue: sanitizeVenue(schedule.venue),
});

export const sanitizeSchedulesByTrainerForPublic = (schedulesByTrainer = {}) =>
  Object.fromEntries(
    Object.entries(schedulesByTrainer).map(([trainerCode, schedules]) => [
      trainerCode,
      (schedules || []).map(sanitizeScheduleForPublic),
    ])
  );

export const sanitizeTrainerForPublic = (trainer) => ({
  name: trainer.name,
  employeeId: trainer.employeeId,
  subjects: (trainer.subjects || []).map((subject) => ({
    name: subject.name,
    code: subject.code,
    slotCount: subject.slotCount,
    slotTimings: subject.slotTimings,
  })),
});

export const sanitizeSubjectForPublic = (subject) => ({
  _id: subject._id,
  code: subject.code,
  name: subject.name,
  slotCount: subject.slotCount,
  slotTimings: subject.slotTimings,
  semester: subject.semester,
});
