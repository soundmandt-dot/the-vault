const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const vm = require('node:vm');
const { join } = require('node:path');

const script = readFileSync(join(__dirname, '..', 'sw.js'), 'utf8');
const scope = 'https://vault.example/app/';

function boot({ at = scope, storage = new Map(), installError } = {}) {
  const listeners = new Map();
  const installed = [];
  const removed = [];
  const network = [];
  let claims = 0;
  let skips = 0;
  vm.runInNewContext(script, {
    URL, Request,
    self: {
      registration: { scope: at },
      addEventListener: (type, callback) => listeners.set(type, callback),
      clients: { claim: async () => { claims++; } },
      skipWaiting: () => { skips++; }
    },
    caches: {
      open: async name => {
        if (!storage.has(name)) storage.set(name, new Map());
        return { addAll: async requests => {
          if (installError) throw installError;
          installed.push({ name, requests });
          for (const request of requests) storage.get(name).set(request.url, new Response('public shell'));
        } };
      },
      keys: async () => [...storage.keys()],
      delete: async name => { removed.push(name); return storage.delete(name); },
      match: async (url, { cacheName }) => storage.get(cacheName)?.get(url)?.clone()
    },
    fetch: async request => { network.push(request); return new Response('network only'); }
  });
  return {
    installed, removed, network, storage,
    claims: () => claims, skips: () => skips,
    send(type, request) {
      let promise;
      listeners.get(type)({ request, waitUntil: value => { promise = value; }, respondWith: value => { promise = value; } });
      return promise;
    }
  };
}

test('install stores exactly index and the checked-in libraries, without credentials', async () => {
  const worker = boot();
  await worker.send('install');
  assert.equal(worker.installed.length, 1);
  const requests = worker.installed[0].requests;
  const files = ['index.html', ...readdirSync(join(__dirname, '..', 'lib')).map(file => `lib/${file}`)];
  assert.deepEqual(Array.from(requests, r => r.url).sort(), files.map(file => new URL(file, scope).href).sort());
  for (const request of requests) {
    assert.equal(request.method, 'GET');
    assert.equal(request.credentials, 'omit');
    assert.equal(request.cache, 'reload');
    assert.equal(request.mode, 'same-origin');
    assert.equal(request.headers.has('Authorization'), false);
  }
});

test('root, subpath and explicit index URLs reopen from their own installed shell', async () => {
  for (const at of ['https://vault.example/', scope, `${scope}:secondary/`]) {
    const worker = boot({ at });
    await worker.send('install');
    for (const path of ['', 'index.html', 'lib/web-llm.js', 'lib/ort-wasm-simd-threaded.jsep.wasm']) {
      const response = await worker.send('fetch', new Request(new URL(path, at)));
      assert.equal(await response.text(), 'public shell');
    }
    assert.equal(worker.network.length, 0);
    assert.equal(worker.installed.length, 1);
  }
});

test('a missing public file uses the network without saving the response', async () => {
  const worker = boot();
  await worker.send('install');
  const url = `${scope}lib/web-llm.js`;
  worker.storage.get(worker.installed[0].name).delete(url);
  const response = await worker.send('fetch', new Request(url));
  assert.equal(await response.text(), 'network only');
  assert.equal(worker.network.length, 1);
  assert.equal(worker.storage.get(worker.installed[0].name).has(url), false);
  assert.equal(worker.installed.length, 1);
});

test('private, model, query, external, POST, authorization and range requests pass through', () => {
  const worker = boot();
  const requests = [
    new Request(`${scope}conversation`),
    new Request(`${scope}models/weights.bin`),
    new Request(`${scope}?prompt=synthetic`),
    new Request(`${scope}index.html?prompt=synthetic`),
    new Request(`${scope}lib/web-llm.js?token=synthetic`),
    new Request('https://models.example/weights.bin'),
    new Request('https://other.example/app/index.html'),
    new Request(scope, { method: 'POST', body: 'synthetic prompt' }),
    new Request(`${scope}index.html`, { headers: { Authorization: 'Bearer synthetic' } }),
    new Request(`${scope}lib/web-llm.js`, { headers: { Range: 'bytes=0-10' } })
  ];
  for (const request of requests) assert.equal(worker.send('fetch', request), undefined);
  assert.equal(worker.storage.size, 0);
  assert.equal(worker.network.length, 0);
  assert.equal(worker.installed.length, 0);
});

test('activation retires only its own older versions, preserving overlapping scopes and model caches', async () => {
  const storage = new Map([['model-cache', new Map()], ['unrelated', new Map()]]);
  const main = boot({ storage });
  const other = boot({ at: 'https://vault.example/other/', storage });
  const nested = boot({ at: `${scope}:secondary/`, storage });
  const escaped = boot({ at: `${scope}%3Asecondary/`, storage });
  for (const worker of [main, other, nested, escaped]) await worker.send('install');
  const currentName = main.installed[0].name;
  const oldName = currentName.replace(/v1$/, 'v0');
  storage.set(oldName, new Map());
  const retained = [...storage.keys()].filter(name => name !== oldName);
  await main.send('activate');
  assert.deepEqual(main.removed, [oldName]);
  assert.deepEqual([...storage.keys()], retained);
  assert.equal(main.claims(), 1);
});

test('failed installation leaves the previous cache intact and does not claim clients', async () => {
  const original = boot();
  await original.send('install');
  const oldName = original.installed[0].name.replace(/v1$/, 'v0');
  const saved = new Map([['synthetic old shell', new Response('previous working version')]]);
  const failure = new Error('synthetic missing bundled file');
  const worker = boot({ storage: new Map([[oldName, saved]]), installError: failure });
  await assert.rejects(worker.send('install'), error => error === failure);
  assert.equal(worker.storage.get(oldName), saved);
  assert.equal(worker.claims(), 0);
  assert.equal(worker.removed.length, 0);
});

test('install does not force a new worker over a live session', async () => {
  const worker = boot();
  await worker.send('install');
  assert.equal(worker.skips(), 0);
  assert.equal(worker.claims(), 0);
});
