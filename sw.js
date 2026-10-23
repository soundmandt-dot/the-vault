// Change this version when index.html or a bundled lib file changes. Updates
// wait for existing tabs to close; a live session keeps its current shell.
const CACHE_PREFIX = `the-vault-shell:${encodeURIComponent(self.registration.scope)}:`;
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const SHELL_URLS = [
  'index.html',
  'lib/web-llm.js',
  'lib/transformers.web.min.js',
  'lib/ort-wasm-simd-threaded.jsep.mjs',
  'lib/ort-wasm-simd-threaded.jsep.wasm'
].map(path => new URL(path, self.registration.scope).href);
const shell = new Set(SHELL_URLS);

self.addEventListener('install', event => {
  // Only checked-in public files enter this cache. No model downloads, user
  // input or runtime responses are stored, and installation sends no cookies.
  const requests = SHELL_URLS.map(url => new Request(url, {
    credentials: 'omit', cache: 'reload', mode: 'same-origin'
  }));
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(requests)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('Authorization') || request.headers.has('Range')) return;
  // The directory and explicit index URL share one public document. Query
  // strings, other paths/origins and model/API requests never match this list.
  const url = request.url === self.registration.scope ? SHELL_URLS[0] : request.url;
  if (!shell.has(url)) return;
  event.respondWith(caches.match(url, { cacheName: CACHE_NAME })
    .then(response => response || fetch(request)));
});
