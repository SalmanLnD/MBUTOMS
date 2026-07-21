import api from './api.js';

export const getStudents = async (params = {}) => {
  const { data } = await api.get('/students', { params });
  return data;
};

export const getStudentById = async (id) => {
  const { data } = await api.get(`/students/${id}`);
  return data;
};

export const createStudent = async (studentData) => {
  const { data } = await api.post('/students', studentData);
  return data;
};

export const updateStudent = async (id, studentData) => {
  const { data } = await api.put(`/students/${id}`, studentData);
  return data;
};

export const deleteStudent = async (id) => {
  const { data } = await api.delete(`/students/${id}`);
  return data;
};

export const downloadStudentBulkTemplate = async () => {
  const { data } = await api.get('/students/bulk/template', {
    responseType: 'blob',
  });
  return data;
};

export const bulkUploadStudents = async (file, { updateExisting = false } = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('updateExisting', updateExisting ? 'true' : 'false');
  const { data } = await api.post('/students/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};
