import { buildAttendanceOifRemap } from './subjectOifCatalog.js';

export const resolvePhotoPunchOif = (input = {}, scheduled = {}) => {
  const mode = input.mode || 'scheduled';
  if (!['scheduled', 'other', 'it', 'capsule'].includes(mode)) throw new Error('Select a valid OIF option.');
  if (mode === 'scheduled') {
    const remap = buildAttendanceOifRemap();
    const numbers = [...new Set((scheduled.schedules || []).map(s => s.oifNumber || remap.get(String(s.subjectCode || '').trim().toUpperCase())).filter(Boolean))];
    return { oifEntryMode: mode, oifNumber: numbers.join(', '), classHandlingHours: scheduled.totalHours || 0, mockPrepHours: 0 };
  }
  if (mode === 'it' || mode === 'capsule') return { oifEntryMode: mode, oifNumber: mode === 'it' ? 'IT' : 'CA26421', classHandlingHours: 0, mockPrepHours: 7 };
  const oifNumber = String(input.oifNumber || '').trim().toUpperCase();
  if (oifNumber === 'IT' || oifNumber === 'CA26421') throw new Error('Select IT or MBU capsule from the OIF type dropdown.');
  if (!/^[A-Z0-9][A-Z0-9 -]{0,11}$/.test(oifNumber)) throw new Error('Enter an OIF number (up to 12 letters, numbers, spaces or hyphens).');
  const hours = key => {
    if (input[key] === '' || input[key] === undefined || input[key] === null) throw new Error('Enter class hours and mock or IT hours; use 0 when not applicable.');
    const value = Number(input[key]);
    if (!Number.isFinite(value) || value < 0 || value > 24) throw new Error('Hours must be between 0 and 24.');
    return value;
  };
  const classHandlingHours = hours('classHandlingHours'), mockPrepHours = hours('mockPrepHours');
  if (classHandlingHours + mockPrepHours > 24) throw new Error('Total hours cannot exceed 24.');
  return { oifEntryMode: mode, oifNumber, classHandlingHours, mockPrepHours };
};
