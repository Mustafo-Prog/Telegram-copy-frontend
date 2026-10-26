import { useSyncExternalStore } from 'react';

const channels = new Map();
const snapshots = new Map();
const timers = new Map();
const listeners = new Set();
const EMPTY = Object.freeze([]);
const publish = (key) => { snapshots.set(key, [...(channels.get(key)?.values() ?? [])]); listeners.forEach((fn) => fn()); };

export function setTypingEvent(event) {
  const channel = event.scope === 'general' ? 'general' : event.conversationId;
  if (!channel || !event.userId) return;
  const timerKey = `${channel}:${event.userId}`;
  clearTimeout(timers.get(timerKey)); timers.delete(timerKey);
  if (!channels.has(channel)) channels.set(channel, new Map());
  if (event.active) {
    channels.get(channel).set(event.userId, { userId: event.userId, displayName: event.displayName });
    timers.set(timerKey, setTimeout(() => setTypingEvent({ ...event, active: false }), Math.min(6000, event.ttl || 5000)));
  } else channels.get(channel).delete(event.userId);
  publish(channel);
}

export function getTyping(channel) { return snapshots.get(channel) ?? EMPTY; }
export function subscribeTyping(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function useTyping(channel) { return useSyncExternalStore(subscribeTyping, () => getTyping(channel)); }
export function resetTyping() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear(); channels.clear(); snapshots.clear(); listeners.forEach((fn) => fn());
}
