import { api } from './http.js';

export const pinGeneralChat = async (pinned) => (await api.patch('/users/me/general-pin', { pinned })).data.user;

export async function updateProfile(data) {
  const { data: body } = await api.patch('/users/me', data);
  return body.user;
}

export async function uploadAvatar(blob) {
  const form = new FormData();
  form.append('avatar', blob, 'avatar');
  const { data: body } = await api.post('/users/me/avatar', form);
  return body.user;
}

export async function removeAvatar() {
  const { data: body } = await api.delete('/users/me/avatar');
  return body.user;
}

export async function searchUsers(query) {
  const { data: body } = await api.get('/users/search', { params: { q: query } });
  return body.users;
}

export async function getProfile(username) {
  const { data: body } = await api.get(`/users/${encodeURIComponent(username)}`);
  return body.user;
}

export async function updatePrivacy(showOnlineStatus) {
  const { data: body } = await api.patch('/users/me/privacy', { showOnlineStatus });
  return body.user;
}
