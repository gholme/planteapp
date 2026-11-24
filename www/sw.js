/* Service worker: appen virker offline, og nye versjoner hentes automatisk.
   Strategi: nett først (med kort tidsavbrudd), ellers lagret kopi. Da trenger man
   ikke bytte versjonsnummer ved hver publisering. */
var CACHE = 'planteapp';
var FILES = [
  './', 'index.html', 'style.css', 'app.js', 'planter-data.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-64.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FILES).then(function () { return cacheImages(c); });
  }).then(function () { return self.skipWaiting(); }));
});

// Plantebildene lagres også, slik at de vises uten nett. Feil på enkeltbilder stopper ikke installasjonen.
function cacheImages(c) {
  return fetch('img/filer.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (list) {
      return Promise.all(list.map(function (f) {
        return c.match(f).then(function (hit) { return hit || c.add(f).catch(function () {}); });
      }));
    })
    .catch(function () {});
}

// Appen ber om at bildene lagres på nytt (f.eks. etter en oppdatering).
self.addEventListener('message', function (e) {
  if (e.data === 'cache-images') e.waitUntil(caches.open(CACHE).then(cacheImages));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function timeout(ms) { return new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); }); }

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    Promise.race([fetch(req, { cache: 'no-cache' }), timeout(4000)])
      .then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (hit) {
          return hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error());
        });
      })
  );
});
