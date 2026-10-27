import { API_ORIGIN } from '../api/http.js';
export { resizeAvatar } from './avatarImage.js';

// Сервер отдаёт путь вида /api/users/:id/avatar?v=..., картинку берём с адреса backend
export function resolveAvatarUrl(src) {
  if (!src) return null;
  return src.startsWith('/') ? `${API_ORIGIN}${src}` : src;
}
