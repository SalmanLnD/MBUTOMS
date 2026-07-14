import api from './api.js';

const publicApi = api;

export const getFeedbackSummary = async () => {
  const { data } = await api.get('/feedback/summary');
  return data;
};

export const getFeedbackResponses = async (params = {}) => {
  const { data } = await api.get('/feedback/responses', { params });
  return data;
};

export const getFeedbackForms = async () => {
  const { data } = await api.get('/feedback/forms');
  return data;
};

export const getCurrentMonthForm = async () => {
  const { data } = await api.get('/feedback/forms/current');
  return data;
};

export const createCurrentMonthForm = async () => {
  const { data } = await api.post('/feedback/forms/current');
  return data;
};

export const updateFeedbackForm = async (id, payload) => {
  const { data } = await api.put(`/feedback/forms/${id}`, payload);
  return data;
};

export const publishFeedbackForm = async (id) => {
  const { data } = await api.post(`/feedback/forms/${id}/publish`);
  return data;
};

export const getPublicFeedbackForm = async (slug) => {
  const { data } = await publicApi.get(`/feedback/public/${slug}`);
  return data;
};

export const submitPublicFeedback = async (slug, answers) => {
  const { data } = await publicApi.post(`/feedback/public/${slug}/submit`, { answers });
  return data;
};

export const getFeedbackSheetStatus = async () => {
  const { data } = await api.get('/feedback/sheets/status');
  return data;
};

export const getFeedbackAppsScriptSetup = async () => {
  const { data } = await api.get('/feedback/sheets/apps-script/setup');
  return data;
};

export const linkFeedbackSheet = async (spreadsheetUrl) => {
  const { data } = await api.post('/feedback/sheets/link', { spreadsheetUrl });
  return data;
};

export const unlinkFeedbackSheet = async () => {
  const { data } = await api.delete('/feedback/sheets/link');
  return data;
};
