const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAugustApi, normalizeServerUrl, createDraftPersistence } = require('../.test-build/shared/index.js');

test('web and native note submissions preserve retry identity and local time', async () => {
  const calls = [];
  const api = createAugustApi('https://journal.example/', async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify({ success: true, noteId: 'saved' }));
  });
  const submission = { content: 'A small moment.', key: 'stable-retry-key', currentTime: '2026-11-12T10:00:00Z', timezone: 'Asia/Kolkata' };
  await api.saveNote(submission);
  await api.saveNote(submission);
  for (const [url, options] of calls) {
    assert.equal(url, 'https://journal.example/api/notes');
    assert.equal(options.headers['Idempotency-Key'], submission.key);
    assert.deepEqual(JSON.parse(options.body), { content: submission.content, currentTime: submission.currentTime, timezone: submission.timezone });
  }
});

test('API failures stay failures rather than becoming an empty journal', async () => {
  const api = createAugustApi('', async () => new Response(JSON.stringify({ error: 'Database unavailable' }), { status: 503 }));
  await assert.rejects(api.items(), /Database unavailable/);
  const invalid = createAugustApi('', async () => new Response('<html>proxy failure</html>', { status: 502 }));
  await assert.rejects(invalid.items(), /unreadable response/);
});

test('request cancellation is passed through and removes the request listener', async () => {
  const controller = new AbortController();
  const api = createAugustApi('', async (_url, options) => {
    controller.abort();
    assert.equal(options.signal.aborted, true);
    throw new DOMException('Aborted', 'AbortError');
  });
  await assert.rejects(api.items('30', controller.signal), { name: 'AbortError' });
});

test('server address validation only allows insecure development connections explicitly', () => {
  assert.equal(normalizeServerUrl(' https://journal.example/ '), 'https://journal.example');
  assert.equal(normalizeServerUrl('http://10.0.2.2:3000', true), 'http://10.0.2.2:3000');
  for (const url of ['http://public.example', 'file:///secret', 'https://user:password@example.com', 'https://example.com/api', 'https://example.com?key=secret']) assert.throws(() => normalizeServerUrl(url));
});

test('draft writes are serialized and store immutable snapshots', async () => {
  const values = [];
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const store = createDraftPersistence({ getItem: async () => values.at(-1) || null, setItem: async (_key, value) => { if (!values.length) await blocked; values.push(value); } }, 'draft');
  const snapshot = { content: 'First', pending: null };
  const first = store.write(snapshot);
  snapshot.content = 'Second';
  const second = store.write(snapshot);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(values.map(value => JSON.parse(value).content), ['First', 'Second']);
  assert.equal((await store.read()).content, 'Second');
});

test('a failed disk write does not poison later draft recovery', async () => {
  let stored = null, attempt = 0;
  const store = createDraftPersistence({ getItem: async () => stored, setItem: async (_key, value) => { if (++attempt === 1) throw new Error('Disk full'); stored = value; } }, 'draft');
  await assert.rejects(store.write({ content: 'First', pending: null }), /Disk full/);
  const pending = { content: 'Second', key: 'same-after-restart', currentTime: '2026-11-12T10:00:00Z', timezone: 'Asia/Kolkata' };
  await store.write({ content: 'Second', pending });
  assert.deepEqual(await store.read(), { content: 'Second', pending });
});
