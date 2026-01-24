const CACHE_NAME = 'livego-v1.0.16';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
];

// Offline timeout configuration (in milliseconds)
// Set to 1 minute for testing, change to 3600000 (1 hour) for production
const OFFLINE_TIMEOUT_MS = 60000; // 1 minute

// Track when we went offline
let offlineStartTime = null;

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Check if offline timeout has expired
function isOfflineTimeoutExpired() {
    if (offlineStartTime === null) return false;
    return (Date.now() - offlineStartTime) > OFFLINE_TIMEOUT_MS;
}

// Fetch event - network first, fallback to cache with timeout
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip API calls and external resources
    if (event.request.url.includes('generativelanguage.googleapis.com')) return;
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Network is working - reset offline timer
                offlineStartTime = null;

                // Clone and cache successful responses
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Network failed - start or continue offline timer
                if (offlineStartTime === null) {
                    offlineStartTime = Date.now();
                    console.log('[SW] Went offline at:', new Date(offlineStartTime).toISOString());
                }

                // Check if offline timeout has expired
                if (isOfflineTimeoutExpired()) {
                    console.log('[SW] Offline timeout expired, refusing to serve cache');

                    // Return an "offline expired" page for navigation requests
                    if (event.request.mode === 'navigate') {
                        return new Response(
                            `<!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <title>Sessão Expirada - LiveGo</title>
                                <style>
                                    body {
                                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                                        color: #fff;
                                        display: flex;
                                        flex-direction: column;
                                        align-items: center;
                                        justify-content: center;
                                        height: 100vh;
                                        margin: 0;
                                        text-align: center;
                                        padding: 20px;
                                    }
                                    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
                                    p { color: #a0a0a0; margin-bottom: 2rem; max-width: 300px; }
                                    button {
                                        background: #4f46e5;
                                        color: white;
                                        border: none;
                                        padding: 12px 32px;
                                        border-radius: 8px;
                                        font-size: 1rem;
                                        cursor: pointer;
                                    }
                                    button:hover { background: #4338ca; }
                                </style>
                            </head>
                            <body>
                                <h1>⏱️ Sessão Offline Expirada</h1>
                                <p>O app ficou muito tempo sem conexão. Reconecte à internet para continuar usando o LiveGo.</p>
                                <button onclick="location.reload()">Tentar Novamente</button>
                            </body>
                            </html>`,
                            {
                                status: 503,
                                headers: { 'Content-Type': 'text/html; charset=utf-8' }
                            }
                        );
                    }

                    return new Response('Offline session expired', { status: 503 });
                }

                // Still within timeout - serve from cache
                const timeRemaining = Math.round((OFFLINE_TIMEOUT_MS - (Date.now() - offlineStartTime)) / 1000);
                console.log('[SW] Serving from cache. Time remaining:', timeRemaining, 'seconds');

                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;

                    // Return offline page for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match('/');
                    }

                    return new Response('Offline', { status: 503 });
                });
            })
    );
});
