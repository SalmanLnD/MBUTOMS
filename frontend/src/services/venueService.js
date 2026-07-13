import api from './api.js';

export const getVenueMappingReference = async () => {
  const { data } = await api.get('/venues/mapping-reference');
  return data;
};

export const getVenues = async (params = {}) => {
  const { data } = await api.get('/venues', { params });
  return data;
};

export const getActiveVenuesForSelect = async () => {
  const venues = [];
  let page = 1;
  let totalPages = 1;

  do {
    const data = await getVenues({
      limit: 100,
      page,
      isActive: 'true',
      sortBy: 'name',
      sortOrder: 'asc',
    });
    venues.push(...(data.venues || []));
    totalPages = data.pagination?.pages || 1;
    page += 1;
  } while (page <= totalPages);

  return venues;
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
