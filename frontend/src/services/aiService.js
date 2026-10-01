import api from './api.js';

export const getAiUsage = async (signal) => {
  const { data } = await api.get('/ai/usage', { signal, timeout: 15_000, skipRetry: true });
  return data;
};

export const sendAiMessage = async (message, signal) => {
  const { data } = await api.post('/ai/chat', { message }, { signal, timeout: 50_000, skipRetry: true });
  return data;
};
