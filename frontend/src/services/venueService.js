import api from './api.js';

export const getVenues = async (params = {}) => {
  const { data } = await api.get('/venues', { params });
  return data;
};

export const getVenueById = async (id) => {
  const { data } = await api.get(`/venues/${id}`);
  return data;
};

export const createVenue = async (venueData) => {
  const { data } = await api.post('/venues', venueData);
  return data;
};

export const updateVenue = async (id, venueData) => {
  const { data } = await api.put(`/venues/${id}`, venueData);
  return data;
};

export const deleteVenue = async (id) => {
  const { data } = await api.delete(`/venues/${id}`);
  return data;
};
