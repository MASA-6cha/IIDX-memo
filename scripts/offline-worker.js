/* Build-time placeholders are replaced by build-offline.mjs. */
const BUILD = '__IIDX_BUILD__';
const ASSETS = /* __IIDX_ASSETS__ */ [];
const PREFIX = 'iidx-app-';
const CACHE = PREFIX + BUILD;
const SHELL = '/IIDX-memo/';
const RECEIPT = '/IIDX-memo/.iidx-offline-receipt';
const assetPaths = new Set(ASSETS);
const absolute = path => new URL(path, self.location.origin).href;

async function download(path, signal) {
  const response = await fetch(new Request(absolute(path), {
    credentials: 'same-origin', cache: 'reload', redirect: 'error', signal,
  }));
  if (!response.ok || response.type === 'opaque' || response.redirected) throw new Error('Download failed');
  const type = response.headers.get('content-type') || '';
  if (path === SHELL) {
    const html = await response.clone().text();
    if (!type.includes('text/html') || !html.includes('data-iidx-app="1"')) throw new Error('Application page missing');
    const references = [...html.matchAll(/(?:src|href)=["'](\/IIDX-memo\/assets\/[^"']+)["']/g)].map(m => m[1]);
    if (!references.length || references.some(p => !assetPaths.has(p))) throw new Error('Application version changed during download');
  } else if (path.endsWith('.js') && !/(javascript|ecmascript)/i.test(type)) {
    throw new Error('Script missing');
  } else if (path.endsWith('.css') && !type.includes('text/css')) {
    throw new Error('Stylesheet missing');
  } else if (type.includes('text/html')) {
    throw new Error('Unexpected sign-in page');
  }
  return response;
}

async function saveOffline() {
  const cache = await caches.open(CACHE);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const shell = await download(SHELL, controller.signal);
    for (let i = 0; i < ASSETS.length; i += 4) {
      await Promise.all(ASSETS.slice(i, i + 4).map(async path => {
        const response = await download(path, controller.signal);
        await cache.put(absolute(path), response);
      }));
    }
    // Mark complete only after the whole app is stored successfully.
    await cache.put(absolute(SHELL), shell);
    await cache.put(absolute(RECEIPT), new Response(JSON.stringify({
      build: BUILD, savedAt: new Date().toISOString(),
    }), {headers: {'Content-Type': 'application/json'}}));
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

async function offlineStatus() {
  const cache = await caches.open(CACHE);
  const receipt = await cache.match(absolute(RECEIPT));
  if (!receipt) return {ready: false};
  const present = await Promise.all([SHELL, ...ASSETS].map(path => cache.match(absolute(path))));
  if (present.some(response => !response)) return {ready: false};
  return {ready: true, ...await receipt.json()};
}

self.addEventListener('install', event => {
  event.waitUntil(saveOffline().catch(async error => {
    await caches.delete(CACHE);
    throw error;
  }));
  // Updated versions wait until explicitly applied, or all old windows close.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Retain recent asset sets so already-open windows can finish editing.
    const others = (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE);
    for (const key of others.slice(0, Math.max(0, others.length - 2))) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && url.pathname === SHELL) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return await cache.match(absolute(SHELL)) || fetch(request);
    })());
  } else if (assetPaths.has(url.pathname) || url.pathname.startsWith('/IIDX-memo/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(absolute(url.pathname));
      if (hit) return hit;
      // Only consult this app's older caches; never caches belonging to other apps.
      for (const key of (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE)) {
        const old = await (await caches.open(key)).match(absolute(url.pathname));
        if (old) return old;
      }
      return fetch(request);
    })());
  }
  // Catalog updates, authentication, API calls and other sites always use the network.
});

self.addEventListener('message', event => {
  const reply = result => event.ports[0]?.postMessage(result);
  if (event.data?.type === 'IIDX_OFFLINE_STATUS') event.waitUntil(offlineStatus().then(reply).catch(() => reply({ready: false})));
  if (event.data?.type === 'IIDX_REPAIR_OFFLINE') event.waitUntil(saveOffline().then(offlineStatus).then(reply).catch(() => reply({ready: false, error: true})));
  if (event.data?.type === 'IIDX_APPLY_UPDATE') event.waitUntil(offlineStatus().then(status => {
    if (status.ready) return self.skipWaiting();
  }));
});
