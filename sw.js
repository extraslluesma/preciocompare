// ============================================================
// sw.js — Service Worker para PrecioCompare PWA
// Estrategia: Cache First para assets estáticos, Network First para el resto
// ============================================================

const CACHE_NAME = 'preciocompare-v6';

// Assets a cachear en la instalación
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
];

// ── Instalación: pre-cachear assets críticos ──────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-cacheando assets...');
      // addAll falla si alguna URL falla; usamos add individual para ser resilientes
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => cache.add(url).catch(() => console.warn('[SW] No se pudo cachear:', url)))
      );
    })
  );
  self.skipWaiting();
});

// ── Activación: limpiar cachés antiguas ───────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Eliminando caché antigua:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: Cache First con fallback a red ────────────────────
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones no GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Cachear respuestas exitosas de origen propio y CDNs
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: si es una navegación, devolver index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
