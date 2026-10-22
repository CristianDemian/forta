const CACHE = 'forta-v53';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'forta-cd-192.png', 'forta-cd-180.png', 'mini-cristian.jpg', 'mini-cristian-flex.jpg', 'mini-cristian-cele.jpg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname === 'api.github.com' || u.pathname.endsWith('.mp4')) return;
  if (u.origin === location.origin) {
    // întâi rețeaua, ca să primești mereu ultima versiune; altfel din memorie
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return res; })));
  }
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { title: 'Forța', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Forța', { body: d.body || '', icon: 'forta-cd-192.png', badge: 'forta-cd-192.png', tag: d.tag || 'forta', data: { url: './#supl' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => { for (const c of list) { if ('focus' in c) return c.focus(); } return self.clients.openWindow('./#supl'); }));
});
