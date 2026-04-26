self.addEventListener('push', e => {
  const d = e.data.json();
  self.registration.showNotification(d.title, {
    body: d.body,
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    data: d.url,
    requireInteraction: d.requireInteraction || false
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data || '/'));
});
