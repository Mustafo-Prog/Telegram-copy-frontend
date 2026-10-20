import { request } from './http.js';

export async function getMessages() {
  const { messages } = await request('/messages');
  return messages;
}

export async function sendMessage(text) {
  const { message } = await request('/messages', { method: 'POST', body: { text } });
  return message;
}
