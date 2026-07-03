import Schedule from '../models/Schedule.js';
import { LRRE_SUBJECT_CODE, LRRE_V_SEMESTER, LRRE_V_TRAINER_EMPLOYEE_IDS } from '../utils/lrreVSemesterTimetable.js';

/**
 * One-time repair: slots added via the timetable UI before semester was passed
 * to the modal were saved as semester III while LRRE V timetables use semester V.
 */
export const repairMisplacedLrreVSemesterSlots = async () => {
  const result = await Schedule.updateMany(
    {
      trainerCode: { $in: LRRE_V_TRAINER_EMPLOYEE_IDS },
      subjectCode: LRRE_SUBJECT_CODE,
      semester: 'III',
    },
    { $set: { semester: LRRE_V_SEMESTER } }
  );

  return { repairedCount: result.modifiedCount || 0 };
};
