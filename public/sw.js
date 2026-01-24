const CACHE_NAME = 'livego-v1.0.16';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
];

// Offline timeout configuration
const OFFLINE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const OFFLINE_START_KEY = 'livego_offline_start';

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

// Helper to get offline start from IndexedDB (localStorage not available in SW)
async function getOfflineStart() {
    try {
        const cache = await caches.open('livego-offline-state');
        const response = await cache.match('offline-start');
        if (response) {
            const data = await response.json();
            return data.timestamp;
        }
    } catch (e) {
        console.log('[SW] Error reading offline state:', e);
    }
    return null;
}

async function setOfflineStart(timestamp) {
    try {
        const cache = await caches.open('livego-offline-state');
        const response = new Response(JSON.stringify({ timestamp }));
        await cache.put('offline-start', response);
    } catch (e) {
        console.log('[SW] Error saving offline state:', e);
    }
}

async function clearOfflineStart() {
    try {
        const cache = await caches.open('livego-offline-state');
        await cache.delete('offline-start');
    } catch (e) {
        console.log('[SW] Error clearing offline state:', e);
    }
}

// Check if offline timeout has expired
async function isOfflineTimeoutExpired() {
    const offlineStart = await getOfflineStart();
    if (offlineStart === null) return false;
    return (Date.now() - offlineStart) > OFFLINE_TIMEOUT_MS;
}

// Fetch event - network first, fallback to cache with persistent timeout
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip API calls and external resources
    if (event.request.url.includes('generativelanguage.googleapis.com')) return;
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        (async () => {
            try {
                const response = await fetch(event.request);

                // Network is working - clear offline timer
                await clearOfflineStart();

                // Clone and cache successful responses
                if (response.ok) {
                    const responseClone = response.clone();
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(event.request, responseClone);
                }
                return response;
            } catch (error) {
                // Network failed - start or continue offline timer
                let offlineStart = await getOfflineStart();

                if (offlineStart === null) {
                    offlineStart = Date.now();
                    await setOfflineStart(offlineStart);
                    console.log('[SW] Went offline at:', new Date(offlineStart).toISOString());
                }

                // Check if offline timeout has expired
                const elapsed = Date.now() - offlineStart;
                if (elapsed > OFFLINE_TIMEOUT_MS) {
                    console.log('[SW] Offline timeout expired (24h), refusing to serve cache');

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
                                <p>O app ficou mais de 24 horas sem conexão com o servidor. Reconecte à internet para continuar usando o LiveGo.</p>
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
                const hoursRemaining = Math.round((OFFLINE_TIMEOUT_MS - elapsed) / (60 * 60 * 1000));
                console.log('[SW] Serving from cache. Hours remaining:', hoursRemaining);

                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) return cachedResponse;

                // Return offline page for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('/');
                }

                return new Response('Offline', { status: 503 });
            }
        })()
    );
});
