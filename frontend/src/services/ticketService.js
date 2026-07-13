import api from './api.js';

export const getTickets = async (params = {}) => {
  const { data } = await api.get('/tickets', { params });
  return data;
};

export const getTicketById = async (id) => {
  const { data } = await api.get(`/tickets/${id}`);
  return data;
};

export const createTicket = async (payload) => {
  const { data } = await api.post('/tickets', payload);
  return data;
};

export const updateTicketStatus = async (id, payload) => {
  const { data } = await api.put(`/tickets/${id}/status`, payload);
  return data;
};
