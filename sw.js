// Hors-ligne : la coquille de l'appli est gardée ; les données viennent de GitHub (et du cache du navigateur).
const VERSION = 'cuisine-v1';
const COQUILLE = ['./', 'index.html', 'app.css', 'manifest.webmanifest', 'icon.svg', 'js/app.js', 'js/api.js', 'js/store.js', 'js/coeur.js', 'js/donnees.js', 'js/ui.js', 'js/recettes.js', 'js/fiche.js', 'js/plan.js', 'js/courses.js', 'js/explorer.js', 'js/stats.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Réseau d'abord (on voit toujours la dernière version), le cache si hors-ligne.
  e.respondWith(
    fetch(e.request).then((r) => {
      const copie = r.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copie));
      return r;
    }).catch(() => caches.match(e.request)),
  );
});
