const CACHE_NAME = 'livego-v1.0.24';
const OFFLINE_STATE_CACHE = 'livego-offline-state';
const OFFLINE_START_REQUEST = '/__livego_offline_start__';
const OFFLINE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const NETWORK_TIMEOUT_MS = 10_000;
const STATIC_ASSETS = ['/', '/app', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names
        .filter((name) => name.startsWith('livego-') && name !== CACHE_NAME && name !== OFFLINE_STATE_CACHE)
        .map((name) => caches.delete(name))
    ))
  );
});

async function getOfflineStart() {
  const cache = await caches.open(OFFLINE_STATE_CACHE);
  const response = await cache.match(OFFLINE_START_REQUEST);
  if (!response) return null;
  const data = await response.json();
  return typeof data.timestamp === 'number' ? data.timestamp : null;
}

async function markOffline() {
  const existing = await getOfflineStart();
  if (existing !== null) return existing;
  const timestamp = Date.now();
  const cache = await caches.open(OFFLINE_STATE_CACHE);
  await cache.put(OFFLINE_START_REQUEST, new Response(JSON.stringify({ timestamp })));
  return timestamp;
}

async function clearOfflineState() {
  const cache = await caches.open(OFFLINE_STATE_CACHE);
  await cache.delete(OFFLINE_START_REQUEST);
}

async function fetchWithTimeout(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function cacheResponse(request, response) {
  if (!response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

function offlineExpiredResponse(request) {
  if (request.mode !== 'navigate') {
    return new Response('Offline session expired', { status: 503 });
  }
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LiveGo offline</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#07080d;color:#fff;font:16px Inter,system-ui"><main style="max-width:420px;padding:32px;text-align:center"><h1>Sessão offline expirada</h1><p style="color:#a1a1aa;line-height:1.6">Reconecte-se à internet para carregar uma versão atualizada do LiveGo.</p><button onclick="location.reload()" style="border:0;border-radius:999px;padding:12px 20px;font-weight:700">Tentar novamente</button></main></body></html>`, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function offlineFallback(request) {
  const offlineStart = await markOffline();
  if (Date.now() - offlineStart > OFFLINE_TIMEOUT_MS) return offlineExpiredResponse(request);

  const cached = await caches.match(request);
  if (cached) return cached;
  if (request.mode === 'navigate') {
    return (await caches.match(request.url.includes('/app') ? '/app' : '/'))
      || (await caches.match('/index.html'))
      || new Response('Offline', { status: 503 });
  }
  return new Response('Offline', { status: 503 });
}

async function networkFirst(request) {
  try {
    const response = await fetchWithTimeout(request);
    await clearOfflineState();
    await cacheResponse(request, response);
    return response;
  } catch {
    return offlineFallback(request);
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  return networkFirst(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstAsset(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
