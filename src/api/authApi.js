import { api } from './http.js';

export async function requestCode(email) {
  const { data } = await api.post('/auth/request-code', { email });
  return data;
}

export async function verifyCode(email, code) {
  const { data } = await api.post('/auth/verify-code', { email, code });
  return data;
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data.user;
}
