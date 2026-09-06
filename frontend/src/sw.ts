/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;

/* ===== 离线缓存(等价于原来自动生成的那份) ===== */
// __WB_MANIFEST 由 vite-plugin-pwa 在构建时注入,必须保留这一行
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.skipWaiting();
clientsClaim();

/* ===== 推送 ===== */

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event: PushEvent) => {
  let data: PushPayload = {};
  try {
    data = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    data = { body: event.data?.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || '我们的小屋', {
      body: data.body || '有新消息 ♡',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // 同 tag 的通知会互相覆盖,避免连发几条时锁屏刷屏
      tag: data.tag || 'love-app',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) || '/';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      // 应用已经在后台开着就直接聚焦,否则新开
      for (const c of clients) {
        if ('focus' in c) {
          await c.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
