import api from './api.js';

export const getTopicTrackerOverview = async (date) => {
  const { data } = await api.get('/topic-tracker/overview', { params: { date } });
  return data;
};

export const getTopicTrackerClassSummary = async (params = {}) => {
  const { data } = await api.get('/topic-tracker/class-summary', { params });
  return data;
};

export const getTopicTrackerSessions = async ({ date, subjectId, trainerId }) => {
  const { data } = await api.get('/topic-tracker/sessions', {
    params: { date, subjectId, trainerId },
  });
  return data;
};

export const upsertTopicTrackerEntry = async (payload) => {
  const { data } = await api.put('/topic-tracker/entries', payload);
  return data;
};

export const updateTopicTrackerStatus = async (entryId, status) => {
  const { data } = await api.patch(`/topic-tracker/entries/${entryId}/status`, { status });
  return data;
};

export const getTopicTrackerSheetStatus = async () => {
  const { data } = await api.get('/topic-tracker/sheets/status');
  return data;
};

export const getTopicTrackerAppsScriptSetup = async () => {
  const { data } = await api.get('/topic-tracker/sheets/apps-script/setup');
  return data;
};

export const linkTopicTrackerSheet = async (spreadsheetUrl) => {
  const { data } = await api.post('/topic-tracker/sheets/link', { spreadsheetUrl });
  return data;
};

export const unlinkTopicTrackerSheet = async () => {
  const { data } = await api.delete('/topic-tracker/sheets/link');
  return data;
};
