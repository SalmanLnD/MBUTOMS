import api from './api.js';

export const getTestReportFilterOptions = async () => {
  const { data } = await api.get('/student-test-reports/filter-options');
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
