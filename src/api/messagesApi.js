import { api } from './http.js';

export async function getMessages() {
  const { data } = await api.get('/messages');
  return data.messages;
}

export async function sendMessage(text) {
  const { data } = await api.post('/messages', { text });
  return data.message;
}
