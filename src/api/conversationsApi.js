import { api } from './http.js';

export async function listConversations() {
  const { data } = await api.get('/conversations');
  return data.conversations;
}

// Открывает существующий личный диалог или создаёт новый
export async function openConversation(userId) {
  const { data } = await api.post('/conversations', { userId });
  return data.conversation;
}

// Последние 50 сообщений; before — id самого старого уже загруженного
export async function getConversationMessages(conversationId, before) {
  const { data } = await api.get(`/conversations/${conversationId}/messages`, {
    params: before ? { before } : {},
  });
  return data;
}

export async function sendConversationMessage(conversationId, text) {
  const { data } = await api.post(`/conversations/${conversationId}/messages`, { text });
  return data.message;
}

export async function editConversationMessage(conversationId, messageId, text) {
  const { data } = await api.patch(`/conversations/${conversationId}/messages/${messageId}`, { text });
  return data.message;
}

export async function bulkDeleteConversationMessages(conversationId, ids, mode) {
  const { data } = await api.post(`/conversations/${conversationId}/messages/bulk-delete`, { ids, mode });
  return data;
}

export async function clearConversation(conversationId, mode) {
  await api.post(`/conversations/${conversationId}/clear`, { mode });
}

export async function deleteConversation(conversationId, mode) {
  await api.delete(`/conversations/${conversationId}`, { data: { mode } });
}
