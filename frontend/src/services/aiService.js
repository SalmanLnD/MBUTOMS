import api from './api.js';

export const sendAiMessage = async (message, signal) => {
  const { data } = await api.post('/ai/chat', { message }, { signal, timeout: 50_000, skipRetry: true });
  return data;
};
