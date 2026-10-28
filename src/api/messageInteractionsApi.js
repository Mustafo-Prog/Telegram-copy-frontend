import { api } from './http.js';

export const getMessageReaders = async (id) => (await api.get(`/messages/${id}/readers`)).data.readers;
export const setMessageReaction = async (id, emoji, active) => (await api.put(`/messages/${id}/reactions`, { emoji, active })).data;
