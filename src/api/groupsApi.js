import { api } from './http.js';

export const getGroup = async (id) => (await api.get(`/groups/${id}`)).data.group;
export const createGroup = async (title, memberIds) => (await api.post('/groups', { title, memberIds })).data.conversation;
export const renameGroup = async (id, title) => (await api.patch(`/groups/${id}`, { title })).data;
export const addGroupMembers = async (id, memberIds) => (await api.post(`/groups/${id}/members`, { memberIds })).data;
export const removeGroupMember = async (id, userId) => (await api.delete(`/groups/${id}/members/${userId}`)).data;
export const setGroupAdmin = async (id, userId, admin) => (await api.patch(`/groups/${id}/admins/${userId}`, { admin })).data;
export const transferGroupOwner = async (id, userId) => (await api.patch(`/groups/${id}/owner`, { userId })).data;
export const leaveGroup = async (id) => (await api.post(`/groups/${id}/leave`)).data;
export const deleteGroup = async (id) => (await api.delete(`/groups/${id}`)).data;
export const createGroupInvite = async (id) => (await api.post(`/groups/${id}/invite`)).data.token;
export const previewGroupInvite = async (token) => (await api.get(`/groups/invites/${encodeURIComponent(token)}`)).data.group;
export const joinGroupInvite = async (token) => (await api.post(`/groups/invites/${encodeURIComponent(token)}/join`)).data.conversation;
