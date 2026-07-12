import api from './api.js';

export const getSubjects = async (params = {}) => {
  const { data } = await api.get('/subjects', { params });
  return data;
};

export const getSubjectById = async (id) => {
  const { data } = await api.get(`/subjects/${id}`);
  return data;
};

export const createSubject = async (subjectData) => {
  const { data } = await api.post('/subjects', subjectData);
  return data;
};

export const updateSubject = async (id, subjectData) => {
  const { data } = await api.put(`/subjects/${id}`, subjectData);
  return data;
};

export const updateSubjectResources = async (id, resourceData) => {
  const { data } = await api.patch(`/subjects/${id}/resources`, resourceData);
  return data;
};

export const deleteSubject = async (id) => {
  const { data } = await api.delete(`/subjects/${id}`);
  return data;
};

export const getSchools = async () => {
  const { data } = await api.get('/subjects/schools/list');
  return data;
};

export const getSemesters = async () => {
  const { data } = await api.get('/subjects/semesters/list');
  return data;
};

export const getDepartments = async (params = {}) => {
  const { data } = await api.get('/subjects/departments/list', { params });
  return data;
};
