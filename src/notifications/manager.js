import { getNotificationPreferences } from './preferences.js';
import { notificationBody, shouldNotifyIncoming, validChatId } from '../utils/notifications.js';

let audioContext;
let registration;
const memorySeen = new Set();
const openNotifications = new Map();

export function unlockNotificationAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  try { audioContext ??= new Context(); audioContext.resume()?.catch(() => {}); } catch { /* Sound is optional. */ }
}

function playSound() {
  if (!audioContext || audioContext.state !== 'running') return;
  try {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(740, audioContext.currentTime);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + 0.2);
  } catch { /* The browser may suspend audio while backgrounded. */ }
}

async function worker() {
  if (!('serviceWorker' in navigator)) return null;
  registration ??= navigator.serviceWorker.register('/notification-sw.js').catch(() => null);
  const result = await registration;
  if (!result) return null;
  return navigator.serviceWorker.ready;
}

export async function requestNotificationPermission() {
  unlockNotificationAudio();
  if (!('Notification' in window) || !window.isSecureContext) return 'unsupported';
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission === 'granted') await worker();
  return permission;
}

function claimMessage(userId, messageId) {
  const id = `${userId}:${messageId}`;
  if (memorySeen.has(id)) return false;
  const storageKey = `tg_notified:${userId}`;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const seen = Array.isArray(saved) ? saved : [];
    if (seen.includes(messageId)) return false;
    localStorage.setItem(storageKey, JSON.stringify([...seen, messageId].slice(-100)));
  } catch { /* Some browsers disable storage in private mode. */ }
  memorySeen.add(id);
  if (memorySeen.size > 500) memorySeen.delete(memorySeen.values().next().value);
  return true;
}

export async function notifyIncoming({ message, userId, chatId, activeChatId, chatVisible, title, labels, onOpen }) {
  const preferences = getNotificationPreferences(userId);
  if (!shouldNotifyIncoming({ message, userId, chatId, activeChatId, chatVisible, enabled: preferences.enabled,
    focused: document.hasFocus(), visible: document.visibilityState === 'visible' }) ||
    !('Notification' in window) || Notification.permission !== 'granted') return false;
  const show = async () => {
    if (!claimMessage(userId, message.id)) return false;
    const pageSound = document.visibilityState === 'visible' && audioContext?.state === 'running';
    const options = { body: notificationBody(message, preferences.preview, labels), tag: `tg-${userId}-${message.id}`,
      renotify: false, silent: !preferences.sound || pageSound, data: { chatId, userId } };
    try {
      const service = await worker();
      if (service) await service.showNotification(title, options);
      else {
        const notification = new Notification(title, options);
        openNotifications.set(notification, userId);
        notification.onclick = () => { window.focus(); onOpen?.(chatId); notification.close(); };
        notification.onclose = () => openNotifications.delete(notification);
      }
      if (preferences.sound && pageSound) playSound();
      return true;
    } catch { return false; }
  };
  try {
    if (navigator.locks?.request) return await navigator.locks.request(`tg-notify:${userId}:${message.id}`, { ifAvailable: true }, (lock) => lock ? show() : false);
    return await show();
  } catch { return false; }
}

export function subscribeNotificationClicks(callback) {
  const handler = (event) => {
    if (event.data?.type === 'notification:open' && validChatId(event.data.chatId)) callback(event.data.chatId);
  };
  navigator.serviceWorker?.addEventListener('message', handler);
  return () => navigator.serviceWorker?.removeEventListener('message', handler);
}

export async function clearUserNotifications(userId) {
  for (const [notification, ownerId] of openNotifications) if (ownerId === userId) { notification.close(); openNotifications.delete(notification); }
  try {
    const service = await navigator.serviceWorker?.getRegistration();
    for (const notification of await service?.getNotifications() ?? []) if (notification.data?.userId === userId) notification.close();
  } catch { /* Notification cleanup must not interrupt sign-out. */ }
}
