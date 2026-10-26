// Хранилище статусов собеседников: online | offline | hidden. Обновляется событиями и ответом на подписку.
import { useSyncExternalStore } from 'react';

const statuses = new Map();
const lastSeen = new Map();
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function setPresence(userId, status, lastSeenAt = null) {
  if (!userId || !status) return;
  const id = String(userId);
  const timestamp = status === 'offline' ? lastSeenAt : null;
  if (statuses.get(id) === status && lastSeen.get(id) === timestamp) return;
  statuses.set(id, status);
  lastSeen.set(id, timestamp);
  emit();
}

export function setPresenceMany(map, timestamps = {}) {
  let changed = false;
  for (const [id, status] of Object.entries(map ?? {})) {
    const timestamp = status === 'offline' ? timestamps[id] ?? null : null;
    if (statuses.get(id) !== status || lastSeen.get(id) !== timestamp) {
      statuses.set(id, status);
      lastSeen.set(id, timestamp);
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

export function getLastSeen(userId) { return lastSeen.get(String(userId)); }

export function useLastSeen(userId) {
  return useSyncExternalStore(subscribePresence, () => (userId ? lastSeen.get(String(userId)) : undefined));
}

// Для тестов и выхода из аккаунта
export function resetPresence() {
  statuses.clear();
  lastSeen.clear();
  emit();
}
