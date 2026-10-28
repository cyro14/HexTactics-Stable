const CACHE_NAME = 'hextactics-v76'; // v76: perfis de comportamento configuráveis (agressivo/defensivo/territorial/fugitivo/reativo)

// Arquivos CORE: sempre pré-cacheados no install
const CORE_ASSETS = [
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
    './icons/icon-512x512.png',
    './img/tiles/tileset12.png',
    './sw.js'
];

// Instala: cacheia os CORE (individual, não falha se 1 arquivo faltar)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // cacheia individualmente (addAll falha se QUALQUER arquivo falhar)
                return Promise.all(
                    CORE_ASSETS.map(url =>
                        cache.add(url).catch(err => {
                            console.warn('[SW] Falha ao cachear:', url, err);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// Ativa: limpa caches antigos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        }).then(() => self.clients.claim())
    );
});

// FETCH: estratégia híbrida com CACHE DINÂMICO
// - HTML: rede primeiro, cache como fallback (offline)
// - Assets: cache primeiro; se não tem no cache, busca na rede E CACHEIA
//   (na próxima visita, funciona offline)
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Ignora requests não-GET (POST, etc.) e cross-origin
    if (event.request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;

    // HTML: rede primeiro (sempre a versão mais recente)
    if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request)
                    .then(cached => cached || caches.match('./index.html'))
                )
        );
        return;
    }

    // Assets (JS, CSS, imagens, fontes): cache-first com cache dinâmico
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) return cached; // tem no cache → serve direto (offline OK)

                // Não tem no cache → busca na rede
                return fetch(event.request)
                    .then(response => {
                        // Sucesso? CACHEIA pra próxima (funciona offline depois)
                        if (response.ok) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                        }
                        return response;
                    })
                    .catch(() => {
                        // Falhou e não tem cache → fallback (não deixa quebrar)
                        return new Response('', { status: 404, statusText: 'Offline' });
                    });
            })
    );
});
