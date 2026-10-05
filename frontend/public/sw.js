/* TOMS push worker. Authenticated pages/API responses are never cached. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

const ownerStore = (value, write = false) => new Promise((resolve, reject) => {
  const request = indexedDB.open('toms-device', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('settings');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const transaction = db.transaction('settings', write ? 'readwrite' : 'readonly');
    const store = transaction.objectStore('settings');
    const action = write ? store.put(value, 'recipient') : store.get('recipient');
    let result;
    action.onsuccess = () => { result = action.result; };
    transaction.oncomplete = () => { db.close(); resolve(write ? value : result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  };
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'TOMS_PUSH_OWNER') return;
  event.waitUntil((async () => {
    try {
      const previous = await ownerStore();
      const next = typeof event.data.recipient === 'string' ? event.data.recipient : null;
      await ownerStore(next, true);
      if (previous !== next || !next) {
        const notifications = await self.registration.getNotifications();
        notifications.forEach(notification => notification.close());
      }
      event.ports[0]?.postMessage({ ok: true });
    } catch { event.ports[0]?.postMessage({ ok: false }); }
  })());
});

const safeUrl = (path) => {
  try {
    const url = new URL(path || '/dashboard', self.location.origin);
    return url.origin === self.location.origin && !url.pathname.startsWith('/api/') ? url.href : new URL('/dashboard', self.location.origin).href;
  } catch { return new URL('/dashboard', self.location.origin).href; }
};

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json() || {}; } catch { /* Always display a visible fallback. */ }
    const owner = await ownerStore().catch(() => null);
    const matches = owner && owner === payload.recipient;
    await self.registration.showNotification('TOMS', {
      body: matches ? String(payload.body || 'You have a new notification').slice(0, 400) : 'Open TOMS to view your notifications.',
      icon: '/icons/toms-192.png', badge: '/icons/toms-badge.png',
      tag: `toms-${payload.id || 'update'}`,
      data: { url: safeUrl(matches ? payload.url : '/dashboard'), recipient: matches ? owner : null },
    });
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: 'TOMS_NOTIFICATION_RECEIVED' }));
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const owner = await ownerStore().catch(() => null);
    const data = event.notification.data || {};
    const url = safeUrl(owner && owner === data.recipient ? data.url : '/dashboard');
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = clients.find(item => new URL(item.url).origin === self.location.origin);
    if (client) { await client.navigate(url); await client.focus(); }
    else await self.clients.openWindow(url);
  })());
});
