import api from './api.js';

export const getNotifications = async (params = {}) => {
  const { data } = await api.get('/notifications', { params });
  return data;
};

export const markNotificationRead = async (id) => {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data;
};

export const markAllNotificationsRead = async () => {
  const { data } = await api.patch('/notifications/read-all');
  return data;
};
