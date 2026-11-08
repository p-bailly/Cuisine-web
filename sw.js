// Ancienne copie du site, retirée : ce service worker remplace l'ancien, efface ses caches et se désinscrit,
// puis recharge les pages ouvertes (elles tombent alors sur la redirection d'index.html).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
  })());
});
