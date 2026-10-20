import { request } from './http.js';

export function register({ email, password, displayName }) {
  return request('/auth/register', { method: 'POST', body: { email, password, displayName } });
}

export function login({ email, password }) {
  return request('/auth/login', { method: 'POST', body: { email, password } });
}

export async function getMe() {
  const { user } = await request('/auth/me');
  return user;
}
