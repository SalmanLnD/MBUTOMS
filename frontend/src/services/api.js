import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('toms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('toms_token');
      localStorage.removeItem('toms_user');
      const path = window.location.pathname;
      const isPublicPath = path === '/timetable' || path.startsWith('/f/');
      if (!isPublicPath && path !== '/login') {
        window.location.href = '/timetable';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
