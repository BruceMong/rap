// Service worker : précache l'app shell, cache-first même origine, dico mis en
// cache au premier chargement différé. Les polices Google (autre origine) passent.
const CACHE = 'rap-v22';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg',
  'js/app.js', 'js/dico.js', 'js/phonetique.js', 'js/syllabes.js', 'js/rimes.js',
  'js/model.js', 'js/store.js', 'js/ui-util.js', 'js/ui-accueil.js', 'js/ui-morceau.js',
  'js/ui-apropos.js', 'js/reglages.js', 'js/backup.js', 'js/ui-instru.js', 'js/ui-instrus.js',
  'js/pads.js', 'js/ui-pads.js', 'js/waveform.js',
]; // le dico (data/lexique-min.json) est caché au 1er chargement différé, pas ici

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return; // polices et autres origines : réseau direct

  // Dico (gros, immuable) : cache-first, mis en cache au 1er chargement différé.
  if (u.pathname.endsWith('lexique-min.json')) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return resp;
      })),
    );
    return;
  }

  // App shell (HTML/CSS/JS) : réseau d'abord → les mises à jour sont visibles dès
  // le rechargement quand on est en ligne ; repli sur le cache hors-ligne.
  e.respondWith(
    fetch(e.request).then((resp) => {
      const copy = resp.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return resp;
    }).catch(() => caches.match(e.request)),
  );
});
