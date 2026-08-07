import api from './api.js';

export const getTestReportFilterOptions = async () => {
  const { data } = await api.get('/student-test-reports/filter-options');
  return data;
};

export const getTestReportSubjects = async (params = {}) => {
  const { data } = await api.get('/student-test-reports/subjects', { params });
  return data;
};

export const getTestReportSummary = async (params = {}) => {
  const { data } = await api.get('/student-test-reports/summary', { params });
  return data;
};

export const getTestReportGrid = async (params = {}) => {
  const { data } = await api.get('/student-test-reports/grid', { params });
  return data;
};

export const bulkUpsertTestReports = async (payload) => {
  const { data } = await api.put('/student-test-reports/bulk', payload);
  return data;
};

export const getTestReportSheetStatus = async () => {
  const { data } = await api.get('/student-test-reports/sheets/status');
  return data;
};

export const getTestReportAppsScriptSetup = async () => {
  const { data } = await api.get('/student-test-reports/sheets/apps-script/setup');
  return data;
};

export const linkTestReportSheet = async (spreadsheetUrl) => {
  const { data } = await api.post('/student-test-reports/sheets/link', { spreadsheetUrl });
  return data;
};

export const downloadTestReportExcel = async (month) => {
  const { data } = await api.get('/student-test-reports/export/excel', {
    params: { month },
    responseType: 'blob',
  });
  return data;
};
