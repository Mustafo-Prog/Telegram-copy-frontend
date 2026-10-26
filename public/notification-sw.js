self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  if (chatId !== 'general' && !/^[a-f0-9]{24}$/i.test(chatId ?? '')) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (target) {
      await target.focus(); target.postMessage({ type: 'notification:open', chatId });
    } else await self.clients.openWindow(`/?chat=${encodeURIComponent(chatId)}`);
  })());
});
