import { ADMIN_TRAINER_EMPLOYEE_ID } from './trainerMappings.js';
import { QAVA_TRAINER_EMPLOYEE_ID } from './qavaTimetable.js';

/** Building/block not declared yet — placeholder until campus blocks are confirmed. */
export const CLASS_VENUE_BUILDING = 'TBD';

export const SAI_PRIYA_SCHEDULE_CODE = 'PSTJ1';

/** Venue numbers for BCA/PSTJ, QAVA, and MCA classes. */
export const CLASS_VENUE_NUMBERS = [1702, 1802, 1803, 1804, 1805, 1810, 1902];

/** Sai Priya PSTJ — one venue per class section (all slots for that section). */
export const SAI_PRIYA_SECTION_VENUES = {
  BCA1: 1702,
  BCA2: 1802,
  'BCA3 & BSC(CS)': 1803,
};

/** Suryadeo Kumar Rana (QAVA) — one venue per class section. */
export const SURYA_DEO_SECTION_VENUES = {
  BCA1: 1804,
  BCA2: 1805,
  'BCA3 & BSC(CS)': 1902,
};

export const ADMIN_MCA_VENUE = 1810;

export const venueNumberToName = (venueNumber) => String(venueNumber);

export const defaultVenueTypeForNumber = () => 'classroom';

export const resolveSaiPriyaVenueNumber = (section) =>
  SAI_PRIYA_SECTION_VENUES[String(section || '').trim()] ?? null;

export const resolveSuryaDeoVenueNumber = (section) =>
  SURYA_DEO_SECTION_VENUES[String(section || '').trim()] ?? null;

export const resolveAdminMcaVenueNumber = () => ADMIN_MCA_VENUE;

export const resolveClassVenueNumber = (schedule) => {
  const trainerCode = String(schedule?.trainerCode || '').trim();
  const department = String(schedule?.department || '').trim();
  const section = String(schedule?.section || '').trim();

  if (trainerCode === SAI_PRIYA_SCHEDULE_CODE && department === 'BCA') {
    return resolveSaiPriyaVenueNumber(section);
  }

  if (trainerCode === QAVA_TRAINER_EMPLOYEE_ID && department === 'BCA') {
    return resolveSuryaDeoVenueNumber(section);
  }

  if (trainerCode === ADMIN_TRAINER_EMPLOYEE_ID && department === 'MCA') {
    return resolveAdminMcaVenueNumber();
  }

  return null;
};
