import { api } from './http.js';

export async function getMessages() {
  const { data } = await api.get('/messages');
  return data.messages;
}

// Страница общего чата: before — id самого старого уже загруженного сообщения
export async function getMessagesPage(before) {
  const { data } = await api.get('/messages', { params: before ? { before } : {} });
  return { messages: data.messages, hasMore: Boolean(data.hasMore) };
}

export async function sendMessage(text) {
  const { data } = await api.post('/messages', { text });
  return data.message;
}

export async function editGeneralMessage(id, text) {
  const { data } = await api.patch(`/messages/${id}`, { text });
  return data.message;
}

export async function bulkDeleteGeneralMessages(ids) {
  const { data } = await api.post('/messages/bulk-delete', { ids });
  return data;
}
