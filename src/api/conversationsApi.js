import { api } from './http.js';
import { messagePayload } from '../utils/messageContent.js';

export async function listConversations({ signal } = {}) {
  const { data } = await api.get('/conversations', { signal });
  return data.conversations;
}

export const openSavedConversation = async () => (await api.post('/conversations/saved')).data.conversation;
export const saveMessage = async (messageId) => (await api.post(`/conversations/saved/messages/${messageId}`)).data;

export const getConversation = async (id) => (await api.get(`/conversations/${id}`)).data.conversation;
export const pinConversation = async (id, pinned) => (await api.patch(`/conversations/${id}/pin`, { pinned })).data.conversation;
export const searchConversationMessages = async (id, q, before) => (await api.get(`/conversations/${id}/search`, { params: { q, ...(before ? { before } : {}) } })).data;

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

export async function sendConversationMessage(conversationId, text, options) {
  const { data } = await api.post(`/conversations/${conversationId}/messages`, messagePayload(text, options));
  return data.message;
}

export async function markConversationRead(conversationId, messageId) {
  const { data } = await api.post(`/conversations/${conversationId}/read`, { messageId });
  return data;
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
