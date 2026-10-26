/* Pisto-Man: guarda la app en el celular para que abra aunque no haya señal.
   Los datos no pasan por aquí: Firebase los guarda en el celular y los sube solo. */
const V = 'pm-v5';
const BASICOS = ['./', './index.html', './repartidor/', './repartidor/index.html', './pm-db.js', './firebase-config.js',
  './logo.webp', './manifest.webmanifest', './repartidor/manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/rep-180.png', './icons/rep-192.png'];
const DE_FUERA = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(BASICOS.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if(r.method !== 'GET') return;
  const u = new URL(r.url);
  const mio = u.origin === self.location.origin;
  if(!mio && !DE_FUERA.includes(u.hostname)) return;          /* Firebase y lo demás: directo a internet */
  if(r.mode === 'navigate'){                                   /* las páginas: primero internet, si no hay, la guardada */
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match(u.pathname.includes('/repartidor/') ? './repartidor/index.html' : './index.html'))));
    return;
  }
  e.respondWith(caches.match(r).then(m => {                     /* lo demás: lo guardado y se actualiza por detrás */
    const red = fetch(r).then(res => { if(res && (res.ok || res.type === 'opaque')){ const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => m);
    return m || red;
  }));
});
