const CACHE_NAME = 'hextactics-v2'; // Mudei o v1 para v2 para forçar a atualização
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/data.js',    // Nossos novos arquivos separados!
    './js/engine.js',
    './js/ui.js',
    './js/main.js',
    './manifest.json',
    './icons/icon-192x192.png', // Verifique se esses nomes batem com os seus ícones reais
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
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
