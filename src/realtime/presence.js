// Хранилище статусов собеседников: online | offline | hidden. Обновляется событиями и ответом на подписку.
import { useSyncExternalStore } from 'react';

const statuses = new Map();
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function setPresence(userId, status) {
  if (!userId || !status) return;
  if (statuses.get(String(userId)) === status) return;
  statuses.set(String(userId), status);
  emit();
}

export function setPresenceMany(map) {
  let changed = false;
  for (const [id, status] of Object.entries(map ?? {})) {
    if (statuses.get(id) !== status) {
      statuses.set(id, status);
      changed = true;
    }
  }
  if (changed) emit();
}

export function getPresence(userId) {
  return statuses.get(String(userId));
}

export function subscribePresence(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Хук: перерисовка только когда меняется статус именно этого пользователя
export function usePresence(userId) {
  return useSyncExternalStore(subscribePresence, () => (userId ? statuses.get(String(userId)) : undefined));
}

// Для тестов и выхода из аккаунта
export function resetPresence() {
  statuses.clear();
  emit();
}
