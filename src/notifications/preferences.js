import { useSyncExternalStore } from 'react';

const cache = new Map();
const listeners = new Set();
export const DEFAULT_PREFERENCES = Object.freeze({ enabled: false, sound: true, preview: false });
const key = (userId) => `tg_notifications:${userId}`;

export function getNotificationPreferences(userId) {
  if (!cache.has(userId)) {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(key(userId))); } catch { saved = null; }
    cache.set(userId, Object.freeze({ enabled: saved?.enabled === true, sound: saved?.sound !== false, preview: saved?.preview === true }));
  }
  return cache.get(userId);
}

export function setNotificationPreferences(userId, change) {
  const current = getNotificationPreferences(userId);
  const next = Object.freeze({ enabled: change.enabled ?? current.enabled, sound: change.sound ?? current.sound, preview: change.preview ?? current.preview });
  cache.set(userId, next);
  try { localStorage.setItem(key(userId), JSON.stringify(next)); } catch { /* Per-session preferences remain available. */ }
  listeners.forEach((fn) => fn());
}

export function useNotificationPreferences(userId) {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => getNotificationPreferences(userId));
}

if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
  if (!event.key?.startsWith('tg_notifications:')) return;
  cache.delete(event.key.slice('tg_notifications:'.length)); listeners.forEach((fn) => fn());
});
