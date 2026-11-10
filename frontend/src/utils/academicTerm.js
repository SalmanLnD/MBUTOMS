export const isAcademicPath = (path = '') => /^\/(subjects|classes|students|student-test-reports|topic-tracker|schedules|sheets)(\/|$)/.test(path);

export const isAcademicPage = (path = '') => /^\/(subjects|classes-students|topic-tracker|timetable)(\/|$)/.test(path)
  || /^\/trainers\/[^/]+\/schedule$/.test(path);

export const termLabel = (term) => term ? `${term.academicYear} / ${term.parity === 'even' ? 'Even' : 'Odd'}` : 'Not published';

export const safeCalendarUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : '';
  } catch { return ''; }
};

let transport = { enabled: false, termId: '', revision: 0, stale: false, generation: 0 };
let controller = new AbortController();

export const getAcademicTransport = () => ({ ...transport, signal: controller.signal });

export const setAcademicTransport = (next) => {
  const changed = transport.termId !== next.termId || transport.revision !== next.revision || transport.enabled !== next.enabled;
  if (changed || next.stale) {
    controller.abort();
    controller = new AbortController();
  }
  transport = { ...transport, ...next, generation: transport.generation + (changed || next.stale ? 1 : 0) };
  return transport.generation;
};
