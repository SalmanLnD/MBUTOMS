import api from './api.js';

export const getTimetableSheetStatus = async () => {
  const { data } = await api.get('/sheets/timetable/status');
  return data;
};

export const getTimetableAppsScriptSetup = async () => {
  const { data } = await api.get('/sheets/timetable/apps-script/setup');
  return data;
};

export const linkTimetableSheet = async (spreadsheetUrl) => {
  const { data } = await api.post('/sheets/timetable/link', { spreadsheetUrl });
  return data;
};

export const unlinkTimetableSheet = async () => {
  const { data } = await api.delete('/sheets/timetable/link');
  return data;
};
