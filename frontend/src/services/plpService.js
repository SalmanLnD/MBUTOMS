import api from './api.js';

export const getPlpSheet = async (month, config = {}) => {
  const { data } = await api.get('/plp', {
    ...config,
    params: { month, ...(config.params || {}) },
  });
  return data;
};

export const getPlpSheetStatus = async () => {
  const { data } = await api.get('/plp/sheets/status');
  return data;
};

export const getPlpAppsScriptSetup = async () => {
  const { data } = await api.get('/plp/sheets/apps-script/setup');
  return data;
};

export const linkPlpSheet = async (spreadsheetUrl) => {
  const { data } = await api.post('/plp/sheets/link', { spreadsheetUrl });
  return data;
};

export const unlinkPlpSheet = async () => {
  const { data } = await api.delete('/plp/sheets/link');
  return data;
};

export const getComplianceList = async (params = {}, config = {}) => {
  const { data } = await api.get('/plp/compliance', {
    ...config,
    params: { ...params, ...(config.params || {}) },
  });
  return data;
};

export const getComplianceTrainers = async (config = {}) => {
  const { data } = await api.get('/plp/compliance/trainers', config);
  return data;
};

export const createCompliance = async (payload) => {
  const { data } = await api.post('/plp/compliance', payload);
  return data;
};

export const deleteCompliance = async (id) => {
  const { data } = await api.delete(`/plp/compliance/${id}`);
  return data;
};
