const CACHE_NAME = 'hextactics-v69'; // v69: ground shadow mais visível + prédios detalhados + FX escalando com dano + shake CSS
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/data.js',
    './js/engine.js',
    './js/ui.js',
    './js/main.js',
    './js/menu-bg.js',
    './js/macro-bg.js',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        }).then(() => self.clients.claim())
    );
});

// ESTRATÉGIA: network-first para navegação (HTML sempre fresco),
// cache-first para o resto (assets estáticos). Isso garante que
// o usuário SEMPRE pegue o index.html novo quando disponível.
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // HTML: rede primeiro, cache como fallback (offline)
    if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // clona pro cache (atualiza o cache com o novo HTML)
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Assets: cache primeiro, rede como fallback
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
